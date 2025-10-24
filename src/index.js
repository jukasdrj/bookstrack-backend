// Placeholder Durable Object class - will be properly implemented in Task 4
export class ProgressWebSocketDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    return new Response('ProgressWebSocketDO placeholder - to be implemented', {
      status: 501
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    return new Response(JSON.stringify({
      status: 'ok',
      worker: 'api-worker',
      version: '1.0.0'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
