import { INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import * as request from 'supertest';

export interface FakeUserData {
  id?: number;
  email: string;
  name: string;
  password: string;
  bio?: string;
  token?: string;
}

export interface FakeArticleData {
  title: string;
  description: string;
  body: string;
  tagList: string[];
}

const SAMPLE_FIRST_NAMES = [
  'Minh',
  'Hoang',
  'Linh',
  'Anh',
  'Tu',
  'Binh',
  'Phuc',
  'Trang',
  'Dung',
  'Nam',
];
const SAMPLE_LAST_NAMES = [
  'Nguyen',
  'Tran',
  'Le',
  'Pham',
  'Hoang',
  'Phan',
  'Vu',
  'Dang',
  'Bui',
  'Do',
];
const SAMPLE_TOPICS = [
  'NestJS Architecture',
  'TypeScript Deep Dive',
  'Database Concurrency',
  'Redis Caching Strategies',
  'RESTful API Best Practices',
  'Clean Code Principles',
  'Microservices in Node.js',
  'TypeORM Performance Optimization',
];
const SAMPLE_TAGS = [
  'nestjs',
  'typescript',
  'nodejs',
  'backend',
  'database',
  'typeorm',
  'redis',
  'testing',
  'architecture',
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomString(length: number = 8): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Sinh dữ liệu giả cho người dùng trước mỗi test case
 */
export function generateFakeUser(
  override: Partial<FakeUserData> = {},
): FakeUserData {
  const rand = getRandomString(6);
  const firstName = getRandomElement(SAMPLE_FIRST_NAMES);
  const lastName = getRandomElement(SAMPLE_LAST_NAMES);

  return {
    email: `user_${rand}@example.com`.toLowerCase(),
    name: `${lastName} ${firstName} ${rand}`,
    password: `P@ssword_${rand}!`,
    bio: `Senior Developer specializing in ${getRandomElement(SAMPLE_TOPICS)}`,
    ...override,
  };
}

/**
 * Sinh dữ liệu giả cho bài viết trước mỗi test case
 */
export function generateFakeArticle(
  override: Partial<FakeArticleData> = {},
): FakeArticleData {
  const rand = getRandomString(6);
  const topic = getRandomElement(SAMPLE_TOPICS);
  const tag1 = getRandomElement(SAMPLE_TAGS);
  let tag2 = getRandomElement(SAMPLE_TAGS);
  while (tag2 === tag1) {
    tag2 = getRandomElement(SAMPLE_TAGS);
  }

  return {
    title: `${topic} Guide Edition ${rand}`,
    description: `Comprehensive overview of modern development patterns for ${topic}.`,
    body: `In this article, we thoroughly explore ${topic}. Key focus points include performance, maintainability, and clean code principles with practical production examples.`,
    tagList: [tag1, tag2],
    ...override,
  };
}

/**
 * Helper đăng ký và đăng nhập người dùng giả trước mỗi test case
 */
export async function createAndLoginUser(
  app: INestApplication,
  override: Partial<FakeUserData> = {},
): Promise<FakeUserData> {
  const fakeData = generateFakeUser(override);

  const regRes = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      email: fakeData.email,
      name: fakeData.name,
      password: fakeData.password,
    })
    .expect(201);

  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: fakeData.email,
      password: fakeData.password,
    })
    .expect(200);

  return {
    id: regRes.body.id,
    email: fakeData.email,
    name: fakeData.name,
    password: fakeData.password,
    token: loginRes.body.accessToken,
  };
}
