/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker application. You can run `npm run dev` in your terminal to start a development server.
 *
 * Learn more about the Workers Typescript template at https://github.com/cloudflare/workers-sdk/tree/main/templates/worker-typescript
 */

import { IRequest } from 'itty-router';

// Define an interface for the environment variables, including the R2 bucket binding
interface Env {
	MY_BUCKET: R2Bucket; // The R2 bucket binding name must match the binding in wrangler.jsonc
	// Add other environment variables or secrets here, e.g., for authentication
	AUTH_SECRET_KEY?: string;
}

// Helper function to add CORS headers
function addCorsHeaders(response: Response): Response {
	response.headers.set('Access-Control-Allow-Origin', '*'); // Or specific origin like http://localhost:3000
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Custom-Auth-Key'); // Include your custom header
	response.headers.set('Access-Control-Max-Age', '86400');
	return response;
}

// Helper function for a basic authorization check (replace with more robust logic in production)
async function authorizeRequest(request: Request, env: Env): Promise<boolean> {
	// Example: Check for a specific header with a pre-shared secret
	const authHeader = request.headers.get('X-Custom-Auth-Key');
	// In a real application, use a Wrangler secret for AUTH_SECRET_KEY
	if (env.AUTH_SECRET_KEY && authHeader === env.AUTH_SECRET_KEY) {
		return true;
	}
	// For demonstration, allow if no secret is configured or header is missing (INSECURE)
	// return !env.AUTH_SECRET_KEY || (env.AUTH_SECRET_KEY === authHeader);

	// *** REPLACE WITH YOUR ACTUAL AUTHORIZATION LOGIC ***
	// For now, we'll require a specific header match if the secret is set.
	return authHeader === env.AUTH_SECRET_KEY;
}

export default {
	// The fetch handler is invoked when this Worker receives a HTTP request
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
		const key = url.pathname.slice(1); // Get the object key from the URL path

		// Handle CORS preflight OPTIONS request
		if (request.method === 'OPTIONS') {
			const corsHeaders = {
				'Access-Control-Allow-Origin': '*', // Or specific origin
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, X-Custom-Auth-Key', // Include your custom header
				'Access-Control-Max-Age': '86400',
			};
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		} else if (request.method === 'PUT') { // Handle PUT requests
			// Apply authorization only to PUT requests (or other modifying methods)
			if (!await authorizeRequest(request, env)) {
				return addCorsHeaders(new Response('Unauthorized', { status: 401 }));
			}

			// Handle file uploads
			if (!request.body) {
				return addCorsHeaders(new Response('Request body is missing', { status: 400 }));
			}
			try {
				// Put the object into the R2 bucket using the binding
				await env.MY_BUCKET.put(key, request.body);
				return addCorsHeaders(new Response(`File ${key} uploaded successfully!`, { status: 200 }));
			} catch (error: any) {
				console.error('R2 put error:', error);
				return addCorsHeaders(new Response(`Failed to upload file ${key}: ${error.message}`, { status: 500 }));
			}
		} else { // Handle all other methods
			// Method not allowed for other HTTP methods
			return addCorsHeaders(new Response('Method Not Allowed', {
				status: 405,
				headers: {
					'Allow': 'PUT', // Only allow PUT for uploads via this endpoint
				},
			}));
		}
	},

	// The scheduled handler is invoked at the intervals configured in wrangler.jsonc by the Cron Trigger.
	// async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
	//   console.log('Worker scheduled event', event);
	// },
};
