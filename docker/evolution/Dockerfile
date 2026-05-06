FROM atendai/evolution-api:v2.2.3

# Evolution API 2.2.3 uses Baileys init queries that can hang for this session
# after WhatsApp opens. Disable the optional parity queries while keeping normal
# connection, message, and webhook handling intact.
RUN sed -i 's/fireInitQueries: true/fireInitQueries: false/' /evolution/node_modules/baileys/lib/Defaults/index.js \
    && sed -i 's/if (fireInitQueries) {/if (false \&\& fireInitQueries) {/' /evolution/node_modules/baileys/lib/Socket/chats.js \
    && grep -q 'fireInitQueries: false' /evolution/node_modules/baileys/lib/Defaults/index.js \
    && grep -q 'if (false && fireInitQueries)' /evolution/node_modules/baileys/lib/Socket/chats.js
