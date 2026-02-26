FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN sed -i 's/listen\s*80;/listen ${PORT};/g' /etc/nginx/conf.d/default.conf && \
    sed -i 's/listen\s*\[::\]:80;/listen [::]:${PORT};/g' /etc/nginx/conf.d/default.conf
CMD sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/default.conf > /tmp/default.conf && mv /tmp/default.conf /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
