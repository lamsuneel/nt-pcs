import { Hono } from 'hono';
import { authRoutes } from './routes/auth';
import { documentRoutes } from './routes/documents';
import { printRoutes } from './routes/print';
import { distributionRoutes } from './routes/distribution';
import { verifyRoutes } from './routes/verify';
import { recallRoutes } from './routes/recalls';
import { reportRoutes } from './routes/reports';
import { dashboardRoutes } from './routes/dashboard';
import { metaRoutes } from './routes/meta';
import { integrationRoutes } from './routes/integrations';
import { printerRoutes } from './routes/printers';
import { overlayProfileRoutes } from './routes/overlay-profiles';

export const app = new Hono().basePath('/api');

app.route('/auth', authRoutes);
app.route('/documents', documentRoutes);
app.route('/print-requests', printRoutes);
app.route('/copies', distributionRoutes);
app.route('/verify', verifyRoutes);
app.route('/recalls', recallRoutes);
app.route('/reports', reportRoutes);
app.route('/dashboard', dashboardRoutes);
app.route('/meta', metaRoutes);
app.route('/integrations', integrationRoutes);
app.route('/printers', printerRoutes);
app.route('/overlay-profiles', overlayProfileRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || 'Internal error' }, 500);
});
