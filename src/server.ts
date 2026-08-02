import express from 'express';
import type { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import type { components } from '../types/api.ts';

const openapiDocument = YAML.load('./openapi.yaml');

type Event = components['schemas']['Event'];
type User = components['schemas']['User'];
type ErrorResponse = components['schemas']['ErrorResponse'];
type AuthResponse = components['schemas']['AuthResponse'];
type LoginRequest = components['schemas']['LoginRequest'];
type RegisterRequest = components['schemas']['RegisterRequest'];

const app = express();
const PORT = 3001;

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// Database Memori Tiruan (In-Memory Storage)
const usersData: User[] = [];
const userCredentials: Record<string, string> = {}; // { username: password }

const eventsData: Event[] = [
  {
    id: 1,
    name: 'Konser Musik K-Pop 2026',
    description: 'Konser megah tahunan',
    address: 'Jakarta International Stadium',
    event_date: '2026-10-15T19:00:00Z',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Endpoint 1: GET /events
app.get('/events', (req: Request, res: Response<Event[] | ErrorResponse>) => {
  res.status(200).json(eventsData);
});

// Endpoint 2: POST /auth/register
app.post('/auth/register', (req: Request<{}, {}, RegisterRequest>, res: Response<User | ErrorResponse>) => {
  const { username, name, email, password } = req.body;

  if (!username || !name || !password) {
    return res.status(400).json({
      message: 'Username, Name, dan Password wajib diisi!',
    });
  }

  // Cek jika username sudah terdaftar
  if (usersData.some((u) => u.username === username)) {
    return res.status(400).json({
      message: 'Username sudah digunakan!',
    });
  }

  const newUser: User = {
    id: usersData.length + 1,
    username,
    name,
    email: email || `${username}@example.com`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Simpan ke memori
  usersData.push(newUser);
  userCredentials[username] = password;

  res.status(201).json(newUser);
});

// Endpoint 3: POST /auth/login
app.post('/auth/login', (req: Request<{}, {}, LoginRequest>, res: Response<AuthResponse | ErrorResponse>) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: 'Username dan Password wajib diisi!',
    });
  }

  // Verifikasi Kredensial
  const savedPassword = userCredentials[username];
  if (!savedPassword || savedPassword !== password) {
    return res.status(401).json({
      message: 'Username atau Password salah!',
    });
  }

  const user = usersData.find((u) => u.username === username);

  // Type Guard: Pastikan user ditemukan agar TypeScript tidak komplain
  if (!user) {
    return res.status(401).json({
      message: 'User tidak ditemukan!',
    });
  }

  // Buat Token Tiruan (mock token)
  const token = `mock-jwt-token-for-${username}-${Date.now()}`;

  res.status(200).json({
    token,
    user,
  });
});


app.listen(PORT, () => {
  console.log(`🚀 Server Backend berjalan di http://localhost:${PORT}`);
  console.log(`📚 Dokumentasi API dapat diakses di http://localhost:${PORT}/docs`);
});
