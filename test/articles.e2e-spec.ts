import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AbstractLoader } from '@nestjs/serve-static/dist/loaders/abstract.loader';
import { ExpressLoader } from '@nestjs/serve-static/dist/loaders/express.loader';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';

describe('Articles CRUD & Feed Flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let user1Token: string;
  let user1Id: number;
  let user2Token: string;
  let user2Id: number;
  let article1Slug: string;

  const mockBlacklist = new Set<string>();
  const mockRedisService = {
    setBlacklistToken: jest.fn().mockImplementation(async (token: string) => {
      mockBlacklist.add(`blacklist:${token}`);
    }),
    isTokenBlacklisted: jest.fn().mockImplementation(async (token: string) => {
      return mockBlacklist.has(`blacklist:${token}`);
    }),
    onModuleDestroy: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(AbstractLoader)
      .useClass(ExpressLoader)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.dropDatabase();
    }
    await app.close();
  });

  it('Setup: Register & Login User 1 (Author) and User 2 (Reader)', async () => {
    // User 1
    const reg1 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'author@example.com',
        name: 'Author One',
        password: 'password123',
      })
      .expect(201);
    user1Id = reg1.body.id;

    const login1 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'author@example.com',
        password: 'password123',
      })
      .expect(200);
    user1Token = login1.body.accessToken;

    // User 2
    const reg2 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'reader@example.com',
        name: 'Reader Two',
        password: 'password123',
      })
      .expect(201);
    user2Id = reg2.body.id;

    const login2 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'reader@example.com',
        password: 'password123',
      })
      .expect(200);
    user2Token = login2.body.accessToken;
  });

  it('POST /api/articles - Create Article 1 & 2', async () => {
    // Create Article 1
    const res1 = await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Mastering NestJS Architecture',
        description: 'Complete guide from zero to hero',
        body: 'NestJS is a progressive Node.js framework...',
        tagList: ['nestjs', 'architecture'],
      })
      .expect(201);

    expect(res1.body.title).toBe('Mastering NestJS Architecture');
    expect(res1.body.slug).toBeDefined();
    expect(res1.body.author.id).toBe(user1Id);
    expect(res1.body.author.name).toBe('Author One');
    article1Slug = res1.body.slug;

    // Create Article 2
    await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'TypeScript Best Practices 2026',
        description: 'Tips and tricks for clean TypeScript',
        body: 'Writing robust TypeScript types...',
        tagList: ['typescript', 'tips'],
      })
      .expect(201);
  });

  it('GET /api/articles - List Articles & Filtering by whole tag and author', async () => {
    // Create articles for testing exact tag match (java vs javascript)
    await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Learn JavaScript from scratch',
        description: 'JavaScript basics',
        body: 'Content for JavaScript...',
        tagList: ['javascript'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Learn Java enterprise',
        description: 'Java basics',
        body: 'Content for Java...',
        tagList: ['java'],
      })
      .expect(201);

    // List all
    const all = await request(app.getHttpServer())
      .get('/api/articles')
      .expect(200);

    expect(all.body.articlesCount).toBe(4);

    // Filter by tag=java should ONLY match 'java', NOT 'javascript'
    const byTagJava = await request(app.getHttpServer())
      .get('/api/articles?tag=java')
      .expect(200);

    expect(byTagJava.body.articlesCount).toBe(1);
    expect(byTagJava.body.articles[0].title).toBe('Learn Java enterprise');

    // Filter by tag=javascript
    const byTagJs = await request(app.getHttpServer())
      .get('/api/articles?tag=javascript')
      .expect(200);

    expect(byTagJs.body.articlesCount).toBe(1);
    expect(byTagJs.body.articles[0].title).toBe(
      'Learn JavaScript from scratch',
    );

    // Filter by tag=nestjs
    const byTag = await request(app.getHttpServer())
      .get('/api/articles?tag=nestjs')
      .expect(200);

    expect(byTag.body.articlesCount).toBe(1);
    expect(byTag.body.articles[0].title).toBe('Mastering NestJS Architecture');

    // Filter by author
    const byAuthor = await request(app.getHttpServer())
      .get('/api/articles?author=Author One')
      .expect(200);

    expect(byAuthor.body.articlesCount).toBe(4);
  });

  it('GET /api/articles/:slug - Get Article by slug', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/articles/${article1Slug}`)
      .expect(200);

    expect(res.body.slug).toBe(article1Slug);
    expect(res.body.title).toBe('Mastering NestJS Architecture');
    expect(res.body.favorited).toBe(false);
    expect(res.body.favoritesCount).toBe(0);
  });

  it('POST /api/articles/:slug/favorite - Favorite Article (idempotent)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/articles/${article1Slug}/favorite`)
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);

    expect(res.body.favorited).toBe(true);
    expect(res.body.favoritesCount).toBe(1);

    // Favorite again: should be idempotent and not crash with 500
    const resAgain = await request(app.getHttpServer())
      .post(`/api/articles/${article1Slug}/favorite`)
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);

    expect(resAgain.body.favorited).toBe(true);
    expect(resAgain.body.favoritesCount).toBe(1);
  });

  it('GET /api/articles/feed - Feed Articles (follow author first)', async () => {
    // Before follow: Feed should be empty
    const feedBefore = await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);
    expect(feedBefore.body.articlesCount).toBe(0);

    // Follow author
    await request(app.getHttpServer())
      .post(`/api/users/${user1Id}/follow`)
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);

    // After follow: Feed should contain author articles
    const feedAfter = await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);

    expect(feedAfter.body.articlesCount).toBe(4);
  });

  it('PATCH /api/articles/:slug - Update Article (author only)', async () => {
    // 403 when User 2 tries to edit
    await request(app.getHttpServer())
      .patch(`/api/articles/${article1Slug}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ title: 'Hacked Title' })
      .expect(403);

    // 400 when empty title is provided
    await request(app.getHttpServer())
      .patch(`/api/articles/${article1Slug}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: '' })
      .expect(400);

    // 200 when Author edits
    const res = await request(app.getHttpServer())
      .patch(`/api/articles/${article1Slug}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Mastering NestJS Architecture (Updated Edition)',
        description: 'New 2026 Edition',
      })
      .expect(200);

    expect(res.body.title).toBe(
      'Mastering NestJS Architecture (Updated Edition)',
    );
    expect(res.body.description).toBe('New 2026 Edition');
    article1Slug = res.body.slug;
  });

  it('DELETE /api/articles/:slug/favorite - Unfavorite Article', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/articles/${article1Slug}/favorite`)
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);

    expect(res.body.favorited).toBe(false);
    expect(res.body.favoritesCount).toBe(0);
  });

  it('DELETE /api/articles/:slug - Delete Article (author only)', async () => {
    // 403 when User 2 tries to delete
    await request(app.getHttpServer())
      .delete(`/api/articles/${article1Slug}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(403);

    // 200 when Author deletes
    await request(app.getHttpServer())
      .delete(`/api/articles/${article1Slug}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);

    // 404 when getting deleted article
    await request(app.getHttpServer())
      .get(`/api/articles/${article1Slug}`)
      .expect(404);
  });
});
