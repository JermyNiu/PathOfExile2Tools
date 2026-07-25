FROM node:22-alpine

WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8766

EXPOSE 8766
CMD ["npm", "start"]
