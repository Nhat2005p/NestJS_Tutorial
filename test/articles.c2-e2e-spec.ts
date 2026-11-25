import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AbstractLoader } from '@nestjs/serve-static/dist/loaders/abstract.loader';
import { ExpressLoader } from '@nestjs/serve-static/dist/loaders/express.loader';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';
import { truncateDatabase } from './helpers/database.helper';
import {
  createAndLoginUser,
  FakeUserData,
  generateFakeArticle,
} from './helpers/faker.helper';

/**
 * PULL 6: E2E TESTING CẤP ĐỘ C2 (Condition & Branch Coverage)
 * - Database test riêng biệt (SQLite in-memory/file).
 * - Truncate DB sạch sẽ sau MỖI test case (afterEach).
 * - Fake data ngẫu nhiên trước MỖI test case (beforeEach & test helpers).
 * - Kiểm thử full luồng qua HTTP Pipeline cho ArticlesController.
 */
describe('ArticlesController - C2 Level E2E Testing (Integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Dữ liệu giả được khởi tạo mới trước mỗi test case
  let author: FakeUserData;
  let reader: FakeUserData;
  let otherUser: FakeUserData;

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
    await dataSource.dropDatabase();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.dropDatabase();
    }
    await app.close();
  });

  // FAKE DATA trước mỗi test case
  beforeEach(async () => {
    author = await createAndLoginUser(app);
    reader = await createAndLoginUser(app);
    otherUser = await createAndLoginUser(app);
  });

  // TRUNCATE DB sau mỗi test case
  afterEach(async () => {
    await truncateDatabase(dataSource);
  });

  // ==========================================
  // 1. POST /api/articles (Create Article)
  // ==========================================
  describe('POST /api/articles - Create Article (C2 Condition Coverage)', () => {
    it('[C2-01] should return 401 Unauthorized when Authorization token is missing', async () => {
      const fakeArticle = generateFakeArticle();
      await request(app.getHttpServer())
        .post('/api/articles')
        .send(fakeArticle)
        .expect(401);
    });

    it('[C2-02] should create article successfully with all valid fields including tagList', async () => {
      const fakeArticle = generateFakeArticle({
        tagList: ['nestjs', 'typeorm', 'testing'],
      });

      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(fakeArticle)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe(fakeArticle.title);
      expect(res.body.slug).toBeDefined();
      expect(res.body.description).toBe(fakeArticle.description);
      expect(res.body.body).toBe(fakeArticle.body);
      expect(res.body.tagList).toEqual(
        expect.arrayContaining(['nestjs', 'typeorm', 'testing']),
      );
      expect(res.body.favoritesCount).toBe(0);
      expect(res.body.favorited).toBe(false);
      expect(res.body.author.id).toBe(author.id);
      expect(res.body.author.name).toBe(author.name);
      expect(res.body.author.password).toBeUndefined(); // Bảo mật: không lộ hash
    });

    it('[C2-03] should create article successfully when tagList is omitted (fallback to empty array)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send({
          title: 'Article Without Tags',
          description: 'No tags provided',
          body: 'Content without tags...',
        })
        .expect(201);

      expect(res.body.tagList).toEqual([]);
    });

    it('[C2-04] should return 400 Bad Request when title is missing or empty string', async () => {
      const fakeArticle = generateFakeArticle();

      // Case: title is empty string
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send({ ...fakeArticle, title: '' })
        .expect(400);

      // Case: title is omitted
      const { title, ...withoutTitle } = fakeArticle;
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(withoutTitle)
        .expect(400);
    });

    it('[C2-05] should return 400 Bad Request when body or description is missing', async () => {
      const fakeArticle = generateFakeArticle();

      // Missing description
      const { description, ...withoutDesc } = fakeArticle;
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(withoutDesc)
        .expect(400);

      // Missing body
      const { body, ...withoutBody } = fakeArticle;
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(withoutBody)
        .expect(400);
    });
  });

  // ==========================================
  // 2. GET /api/articles (List & Filtering)
  // ==========================================
  describe('GET /api/articles - List & Filter Articles (C2 Condition Coverage)', () => {
    let articleA: any;
    let articleB: any;

    beforeEach(async () => {
      // Fake bài viết 1 với tag 'java' của Author
      const resA = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send({
          title: 'Deep Dive into Java Core',
          description: 'Java language tutorial',
          body: 'Java virtual machine details...',
          tagList: ['java', 'backend'],
        })
        .expect(201);
      articleA = resA.body;

      // Fake bài viết 2 với tag 'javascript' của Reader
      const resB = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${reader.token}`)
        .send({
          title: 'Modern JavaScript Guide',
          description: 'ESNext features',
          body: 'JavaScript promises and async/await...',
          tagList: ['javascript', 'frontend'],
        })
        .expect(201);
      articleB = resB.body;
    });

    it('[C2-06] should return all articles when no filter query is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/articles')
        .expect(200);

      expect(res.body.articlesCount).toBe(2);
      expect(res.body.articles.length).toBe(2);
    });

    it('[C2-07] should filter by exact whole tag (tag=java must NOT return javascript)', async () => {
      // Query tag=java
      const resJava = await request(app.getHttpServer())
        .get('/api/articles?tag=java')
        .expect(200);

      expect(resJava.body.articlesCount).toBe(1);
      expect(resJava.body.articles[0].id).toBe(articleA.id);

      // Query tag=javascript
      const resJs = await request(app.getHttpServer())
        .get('/api/articles?tag=javascript')
        .expect(200);

      expect(resJs.body.articlesCount).toBe(1);
      expect(resJs.body.articles[0].id).toBe(articleB.id);

      // Query non-existent tag
      const resNone = await request(app.getHttpServer())
        .get('/api/articles?tag=nonexistenttag')
        .expect(200);

      expect(resNone.body.articlesCount).toBe(0);
      expect(resNone.body.articles).toEqual([]);
    });

    it('[C2-08] should filter by author name correctly', async () => {
      // Filter by Author's name
      const resByAuthor = await request(app.getHttpServer())
        .get(`/api/articles?author=${encodeURIComponent(author.name)}`)
        .expect(200);

      expect(resByAuthor.body.articlesCount).toBe(1);
      expect(resByAuthor.body.articles[0].author.id).toBe(author.id);

      // Filter by non-existent author
      const resByUnknown = await request(app.getHttpServer())
        .get('/api/articles?author=Nobody')
        .expect(200);

      expect(resByUnknown.body.articlesCount).toBe(0);
    });

    it('[C2-09] should filter by favorited username correctly', async () => {
      // Reader favorites Article A
      await request(app.getHttpServer())
        .post(`/api/articles/${articleA.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      // Query articles favorited by Reader
      const resFav = await request(app.getHttpServer())
        .get(`/api/articles?favorited=${encodeURIComponent(reader.name)}`)
        .expect(200);

      expect(resFav.body.articlesCount).toBe(1);
      expect(resFav.body.articles[0].id).toBe(articleA.id);

      // Query articles favorited by Author (none)
      const resNone = await request(app.getHttpServer())
        .get(`/api/articles?favorited=${encodeURIComponent(author.name)}`)
        .expect(200);

      expect(resNone.body.articlesCount).toBe(0);
    });

    it('[C2-10] should handle pagination with limit and offset', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/articles?limit=1&offset=0')
        .expect(200);

      expect(res.body.articlesCount).toBe(2);
      expect(res.body.articles.length).toBe(1);

      const resOffset = await request(app.getHttpServer())
        .get('/api/articles?limit=1&offset=1')
        .expect(200);

      expect(resOffset.body.articlesCount).toBe(2);
      expect(resOffset.body.articles.length).toBe(1);
      expect(resOffset.body.articles[0].id).not.toBe(res.body.articles[0].id);
    });

    it('[C2-11] should reflect favorited and following status when requested with Bearer token', async () => {
      // OtherUser follows Author and favorites Article A
      await request(app.getHttpServer())
        .post(`/api/users/${author.id}/follow`)
        .set('Authorization', `Bearer ${otherUser.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/articles/${articleA.slug}/favorite`)
        .set('Authorization', `Bearer ${otherUser.token}`)
        .expect(200);

      // Authenticated request
      const authRes = await request(app.getHttpServer())
        .get('/api/articles')
        .set('Authorization', `Bearer ${otherUser.token}`)
        .expect(200);

      const foundA = authRes.body.articles.find(
        (a: any) => a.id === articleA.id,
      );
      expect(foundA.favorited).toBe(true);
      expect(foundA.author.following).toBe(true);

      const foundB = authRes.body.articles.find(
        (a: any) => a.id === articleB.id,
      );
      expect(foundB.favorited).toBe(false);
      expect(foundB.author.following).toBe(false);

      // Unauthenticated request
      const unauthRes = await request(app.getHttpServer())
        .get('/api/articles')
        .expect(200);

      unauthRes.body.articles.forEach((a: any) => {
        expect(a.favorited).toBe(false);
        expect(a.author.following).toBe(false);
      });
    });
  });

  // ==========================================
  // 3. GET /api/articles/:slug (Get Article)
  // ==========================================
  describe('GET /api/articles/:slug - Get Article Details (C2 Condition Coverage)', () => {
    let createdArticle: any;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(generateFakeArticle())
        .expect(201);
      createdArticle = res.body;
    });

    it('[C2-12] should retrieve article by slug successfully', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/articles/${createdArticle.slug}`)
        .expect(200);

      expect(res.body.id).toBe(createdArticle.id);
      expect(res.body.title).toBe(createdArticle.title);
    });

    it('[C2-13] should retrieve article by numeric ID successfully', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/articles/${createdArticle.id}`)
        .expect(200);

      expect(res.body.slug).toBe(createdArticle.slug);
    });

    it('[C2-14] should return 404 Not Found when slug or ID does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/articles/non-existent-slug-xyz')
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/articles/9999999')
        .expect(404);
    });
  });

  // ==========================================
  // 4. GET /api/articles/feed (Feed Articles)
  // ==========================================
  describe('GET /api/articles/feed - Feed Articles (C2 Condition Coverage)', () => {
    let authorArticle: any;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(generateFakeArticle())
        .expect(201);
      authorArticle = res.body;
    });

    it('[C2-15] should return 401 Unauthorized when not logged in', async () => {
      await request(app.getHttpServer()).get('/api/articles/feed').expect(401);
    });

    it('[C2-16] should return empty articles list when user follows nobody', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/articles/feed')
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      expect(res.body.articlesCount).toBe(0);
      expect(res.body.articles).toEqual([]);
    });

    it('[C2-17] should return articles of followed authors', async () => {
      // Reader follows Author
      await request(app.getHttpServer())
        .post(`/api/users/${author.id}/follow`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/articles/feed')
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      expect(res.body.articlesCount).toBe(1);
      expect(res.body.articles[0].id).toBe(authorArticle.id);
      expect(res.body.articles[0].author.following).toBe(true);
    });
  });

  // ==========================================
  // 5. PATCH /api/articles/:slug (Update Article)
  // ==========================================
  describe('PATCH /api/articles/:slug - Update Article (C2 Condition Coverage)', () => {
    let createdArticle: any;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(generateFakeArticle())
        .expect(201);
      createdArticle = res.body;
    });

    it('[C2-18] should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${createdArticle.slug}`)
        .send({ title: 'New Title' })
        .expect(401);
    });

    it('[C2-19] should return 403 Forbidden when non-author attempts to edit article', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${createdArticle.slug}`)
        .set('Authorization', `Bearer ${reader.token}`)
        .send({ title: 'Hacked Title' })
        .expect(403);
    });

    it('[C2-20] should return 404 Not Found when editing non-existent article', async () => {
      await request(app.getHttpServer())
        .patch('/api/articles/invalid-slug')
        .set('Authorization', `Bearer ${author.token}`)
        .send({ title: 'New Title' })
        .expect(404);
    });

    it('[C2-21] should return 400 Bad Request when title is empty string', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${createdArticle.slug}`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ title: '' })
        .expect(400);
    });

    it('[C2-22] should successfully update title and regenerate new slug', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/articles/${createdArticle.slug}`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ title: 'Completely New Awesome Title' })
        .expect(200);

      expect(res.body.title).toBe('Completely New Awesome Title');
      expect(res.body.slug).not.toBe(createdArticle.slug);
      expect(res.body.slug).toContain('completely-new-awesome-title');
    });

    it('[C2-23] should successfully update partial fields independently (description, body, tagList)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/articles/${createdArticle.slug}`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({
          description: 'Updated Description Only',
          tagList: ['updated', 'tags'],
        })
        .expect(200);

      expect(res.body.description).toBe('Updated Description Only');
      expect(res.body.tagList).toEqual(
        expect.arrayContaining(['updated', 'tags']),
      );
      expect(res.body.title).toBe(createdArticle.title); // Title remains unchanged
    });
  });

  // ==========================================
  // 6. DELETE /api/articles/:slug (Delete Article)
  // ==========================================
  describe('DELETE /api/articles/:slug - Delete Article (C2 Condition Coverage)', () => {
    let createdArticle: any;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(generateFakeArticle())
        .expect(201);
      createdArticle = res.body;
    });

    it('[C2-24] should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${createdArticle.slug}`)
        .expect(401);
    });

    it('[C2-25] should return 403 Forbidden when non-author attempts to delete', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${createdArticle.slug}`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(403);
    });

    it('[C2-26] should return 404 Not Found when deleting non-existent article', async () => {
      await request(app.getHttpServer())
        .delete('/api/articles/non-existent-slug')
        .set('Authorization', `Bearer ${author.token}`)
        .expect(404);
    });

    it('[C2-27] should delete article successfully when executed by author', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/articles/${createdArticle.slug}`)
        .set('Authorization', `Bearer ${author.token}`)
        .expect(200);

      expect(res.body.message).toContain('thành công');

      // Verify article is no longer found
      await request(app.getHttpServer())
        .get(`/api/articles/${createdArticle.slug}`)
        .expect(404);
    });
  });

  // ==========================================
  // 7. Favorite & Unfavorite Flow (Idempotency & Concurrency)
  // ==========================================
  describe('POST & DELETE /api/articles/:slug/favorite - Favorite Flow (C2 Condition Coverage)', () => {
    let createdArticle: any;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send(generateFakeArticle())
        .expect(201);
      createdArticle = res.body;
    });

    it('[C2-28] should return 401 Unauthorized when favoriting without token', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${createdArticle.slug}/favorite`)
        .expect(401);
    });

    it('[C2-29] should return 404 Not Found when favoriting non-existent article', async () => {
      await request(app.getHttpServer())
        .post('/api/articles/non-existent-article/favorite')
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(404);
    });

    it('[C2-30] should favorite article, increment count, and remain idempotent on repeated calls', async () => {
      // First favorite call
      const res1 = await request(app.getHttpServer())
        .post(`/api/articles/${createdArticle.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      expect(res1.body.favorited).toBe(true);
      expect(res1.body.favoritesCount).toBe(1);

      // Second favorite call (idempotent, does not throw 500 duplicate key error)
      const res2 = await request(app.getHttpServer())
        .post(`/api/articles/${createdArticle.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      expect(res2.body.favorited).toBe(true);
      expect(res2.body.favoritesCount).toBe(1);
    });

    it('[C2-31] should unfavorite article and decrement count safely', async () => {
      // Favorite first
      await request(app.getHttpServer())
        .post(`/api/articles/${createdArticle.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      // Unfavorite
      const res = await request(app.getHttpServer())
        .delete(`/api/articles/${createdArticle.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      expect(res.body.favorited).toBe(false);
      expect(res.body.favoritesCount).toBe(0);
    });

    it('[C2-32] should guard against negative favoritesCount when unfavoriting an article with 0 favorites', async () => {
      // Unfavorite directly without favoriting first
      const res = await request(app.getHttpServer())
        .delete(`/api/articles/${createdArticle.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      expect(res.body.favorited).toBe(false);
      expect(res.body.favoritesCount).toBe(0); // Giữ nguyên 0, không bị âm
    });
  });
});
