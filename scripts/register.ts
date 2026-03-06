/**
 * One-time slash command registration script.
 *
 * Usage (reads credentials from .dev.vars automatically):
 *   npm run register
 *
 * To register to a specific guild only (instant propagation, good for testing),
 * add DISCORD_GUILD_ID to .dev.vars before running.
 *
 * Global commands take up to 1 hour to propagate. Guild commands are instant.
 */

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional

if (!token || !applicationId) {
  console.error('Error: DISCORD_TOKEN and DISCORD_APPLICATION_ID env vars are required.');
  process.exit(1);
}

const commands = [
  {
    name: 'createpoll',
    description: 'Create a ranked-choice poll',
    options: [
      {
        type: 3, // STRING
        name: 'question',
        description: 'The poll question',
        required: true,
      },
    ],
  },
];

async function main() {
  const url = guildId
    ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${applicationId}/commands`;

  const scope = guildId ? `guild ${guildId}` : 'globally';
  console.log(`Registering ${commands.length} command(s) ${scope}…`);

  const response = await fetch(url, {
    method: 'PUT', // PUT replaces all commands atomically
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to register commands (${response.status}):`, text);
    process.exit(1);
  }

  const data = await response.json() as Array<{ id: string; name: string }>;
  console.log('Successfully registered commands:');
  for (const cmd of data) {
    console.log(`  /${cmd.name} (id: ${cmd.id})`);
  }
}

main();
