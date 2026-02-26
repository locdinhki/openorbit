// ============================================================================
// OpenOrbit — Discord Client
//
// discord.js client wrapper. Handles bot login, DM message routing,
// button interactions, and slash command dispatch.
// ============================================================================

import { Client, GatewayIntentBits, Partials, ChannelType, REST, Routes } from 'discord.js'
import type { Message, Interaction, Attachment } from 'discord.js'
import type { Logger } from '@openorbit/core/extensions/types'
import type { VoiceTranscriber } from '@openorbit/core/audio/voice-transcriber'
import type { SlashCommandDef } from './commands'
import { chunkMessage } from './formatters'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscordConfig {
  token: string
  authorizedUserIds: string[] // snowflake IDs, empty = allow all
}

export type MessageHandler = (userId: string, text: string) => Promise<string>
export type CallbackHandler = (userId: string, data: string) => Promise<string>
export type SlashCommandHandler = (userId: string, commandName: string) => Promise<string>

// ---------------------------------------------------------------------------
// DiscordClient
// ---------------------------------------------------------------------------

export class DiscordClient {
  private client: Client | null = null
  private token: string
  private authorizedUserIds: Set<string>
  private log: Logger
  private running = false
  private onMessage: MessageHandler | null = null
  private onCallback: CallbackHandler | null = null
  private onSlashCommand: SlashCommandHandler | null = null
  private transcriber: VoiceTranscriber | null = null

  constructor(config: DiscordConfig, log: Logger) {
    this.token = config.token
    this.log = log
    this.authorizedUserIds = new Set(config.authorizedUserIds)
  }

  setTranscriber(transcriber: VoiceTranscriber): void {
    this.transcriber = transcriber
  }

  setMessageHandler(handler: MessageHandler): void {
    this.onMessage = handler
  }

  setCallbackHandler(handler: CallbackHandler): void {
    this.onCallback = handler
  }

  setSlashCommandHandler(handler: SlashCommandHandler): void {
    this.onSlashCommand = handler
  }

  isRunning(): boolean {
    return this.running
  }

  isAuthorized(userId: string): boolean {
    if (this.authorizedUserIds.size === 0) return true
    return this.authorizedUserIds.has(userId)
  }

  async registerSlashCommands(commands: SlashCommandDef[]): Promise<void> {
    if (!this.client?.user) return

    const rest = new REST({ version: '10' }).setToken(this.token)
    const body = commands.map((cmd) => cmd.toJSON())

    try {
      await rest.put(Routes.applicationCommands(this.client.user.id), { body })
      this.log.info(`Registered ${commands.length} slash commands`)
    } catch (err) {
      this.log.error('Failed to register slash commands:', err)
    }
  }

  async start(): Promise<void> {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: [Partials.Channel]
    })

    this.client.on('ready', () => {
      this.running = true
      this.log.info(`Discord bot logged in as ${this.client!.user?.tag}`)
    })

    this.client.on('messageCreate', async (msg: Message) => {
      // Ignore bot messages
      if (msg.author.bot) return

      // DM-only
      if (msg.channel.type !== ChannelType.DM) return

      // Authorization check
      if (!this.isAuthorized(msg.author.id)) {
        this.log.warn(`Unauthorized Discord DM from ${msg.author.id}`)
        await msg.reply('Not authorized to use this bot.')
        return
      }

      // Check for audio attachments (voice messages)
      const audioAttachment = msg.attachments.find(
        (a: Attachment) => a.contentType?.startsWith('audio/') ?? false
      )

      if (audioAttachment && !msg.content?.trim()) {
        if (!this.onMessage) return

        if (!this.transcriber) {
          await msg.reply('Voice messages are not supported. Please send text instead.')
          return
        }

        try {
          const audioPath = await this.downloadAttachment(
            audioAttachment.url,
            audioAttachment.name ?? 'audio.ogg'
          )
          const { transcript } = await this.transcriber.transcribe(audioPath)
          cleanupFile(audioPath)

          if (!transcript.trim()) {
            await msg.reply('Could not transcribe the voice message. Please try again.')
            return
          }

          const response = await this.onMessage(msg.author.id, transcript)
          if (response) {
            const chunks = chunkMessage(response)
            for (const chunk of chunks) {
              await msg.reply(chunk)
            }
          }
        } catch (err) {
          this.log.error('Error processing Discord voice message:', err)
          await msg.reply('Sorry, something went wrong processing your voice message.')
        }
        return
      }

      if (!msg.content?.trim() || !this.onMessage) return

      try {
        const response = await this.onMessage(msg.author.id, msg.content.trim())
        if (response) {
          const chunks = chunkMessage(response)
          for (const chunk of chunks) {
            await msg.reply(chunk)
          }
        }
      } catch (err) {
        this.log.error('Error processing Discord message:', err)
        await msg.reply('Sorry, something went wrong.')
      }
    })

    this.client.on('interactionCreate', async (interaction: Interaction) => {
      // Button interactions
      if (interaction.isButton()) {
        if (!this.isAuthorized(interaction.user.id)) {
          await interaction.reply({ content: 'Not authorized.', ephemeral: true })
          return
        }

        if (!this.onCallback) return

        try {
          const result = await this.onCallback(interaction.user.id, interaction.customId)
          await interaction.reply({ content: result, ephemeral: false })
        } catch (err) {
          this.log.error('Error processing button interaction:', err)
          await interaction.reply({ content: 'Error processing action.', ephemeral: true })
        }
        return
      }

      // Slash command interactions
      if (interaction.isChatInputCommand()) {
        if (!this.isAuthorized(interaction.user.id)) {
          await interaction.reply({ content: 'Not authorized.', ephemeral: true })
          return
        }

        if (!this.onSlashCommand) return

        try {
          await interaction.deferReply()
          const result = await this.onSlashCommand(interaction.user.id, interaction.commandName)
          await interaction.editReply(result)
        } catch (err) {
          this.log.error('Error processing slash command:', err)
          if (interaction.deferred) {
            await interaction.editReply('Error processing command.')
          }
        }
      }
    })

    await this.client.login(this.token)
  }

  stop(): void {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
    this.running = false
  }

  // -------------------------------------------------------------------------
  // File download (for voice messages)
  // -------------------------------------------------------------------------

  private async downloadAttachment(url: string, filename: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const { writeFileSync } = await import('fs')
    const { randomUUID } = await import('crypto')

    const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.ogg'
    const tmpPath = join(tmpdir(), `discord-voice-${randomUUID()}${ext}`)
    writeFileSync(tmpPath, buffer)
    return tmpPath
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanupFile(filePath: string): void {
  try {
    const { unlinkSync } = require('fs') as typeof import('fs') // eslint-disable-line @typescript-eslint/no-require-imports
    unlinkSync(filePath)
  } catch {
    // Best-effort cleanup
  }
}
