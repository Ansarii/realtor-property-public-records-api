FROM apify/actor-node-playwright-chrome:20

COPY --chown=myuser:myuser package*.json ./
RUN npm --quiet set progress=false \
    && npm install --include=dev

COPY --chown=myuser:myuser tsconfig.json ./
COPY --chown=myuser:myuser src ./src

RUN npm run build

CMD ["npm", "start"]
