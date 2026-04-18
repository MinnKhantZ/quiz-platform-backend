// Mock for @prisma/client — reused across all test files.
// Import via: import prisma from '../src/config/db.js' after vi.mock('../src/config/db.js')

export const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  quiz: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  question: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    updateMany: vi.fn(),
  },
  attempt: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  answer: {
    createMany: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(prismaMock)),
};

export default prismaMock;
