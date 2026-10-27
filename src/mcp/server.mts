import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

const server = new McpServer({
    name: 'zoho-hubspot-mcp',
    version: '1.0.0',
});

server.registerTool(
    'hello_mcp',
    {
        title: 'Hello MCP',
        description: 'A simple test tool to verify the MCP server connection.',
        inputSchema: {
            name: z.string().describe('Name of the person to greet'),
        },
    },
    async ({ name }) => ({
        content: [
            {
                type: 'text',
                text: `Hello ${name}! MCP server is working successfully.`,
            },
        ],
    }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
