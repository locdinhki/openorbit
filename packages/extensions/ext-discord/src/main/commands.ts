// ============================================================================
// OpenOrbit — Discord Slash Command Definitions
//
// Defines the slash commands available for the Discord bot.
// ============================================================================

import { SlashCommandBuilder } from 'discord.js'

export type SlashCommandDef = SlashCommandBuilder

export const COMMANDS: SlashCommandDef[] = [
  new SlashCommandBuilder().setName('jobs').setDescription('List new job listings'),

  new SlashCommandBuilder().setName('approved').setDescription('List approved jobs'),

  new SlashCommandBuilder().setName('applied').setDescription('List applied jobs'),

  new SlashCommandBuilder().setName('profiles').setDescription('List search profiles'),

  new SlashCommandBuilder().setName('status').setDescription('Show automation status summary'),

  new SlashCommandBuilder().setName('log').setDescription('Show recent action log'),

  new SlashCommandBuilder().setName('help').setDescription('Show available commands')
]
