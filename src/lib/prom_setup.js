import http from 'http';
import url from 'url';
import client from 'prom-client';

const setupPromClient = (metricsPort, speedrunId) => {
  // Create a Registry which registers the metrics
  const register = new client.Registry()

  // Add a default label which is added to all metrics
  register.setDefaultLabels({
    app: 'minecraft_bot',
    speedrunId
  })

  // Enable the collection of default metrics
  client.collectDefaultMetrics({register})

  // Define the HTTP server
  const server = http.createServer(async (req, res) => {
    // Retrieve route from request object
    const route = url.parse(req.url).pathname

    if (route === '/metrics') {
      // Return all metrics the Prometheus exposition format
      res.setHeader('Content-Type', register.contentType)
      res.end(await register.metrics())
    }
  })

  // Start the HTTP server which exposes the metrics on http://localhost:8080/metrics
  server.listen(metricsPort)

  return [client, register];
};

export default setupPromClient;
