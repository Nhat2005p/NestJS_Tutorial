import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AbstractLoader } from '@nestjs/serve-static/dist/loaders/abstract.loader';
import { ExpressLoader } from '@nestjs/serve-static/dist/loaders/express.loader';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';

describe('Comments CRD Flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authorToken: string;
  let authorId: number;
  let commenterToken: string;
  let commenterId: number;
  let otherToken: string;
  let articleSlug: string;
  let commentId: number;

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

  it('Setup: Register & Login Users (Author, Commenter, Other)', async () => {
    // 1. Author
    const regAuthor = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'author_comment@example.com',
        name: 'Article Author',
        password: 'password123',
      })
      .expect(201);
    authorId = regAuthor.body.id;

    const loginAuthor = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'author_comment@example.com',
        password: 'password123',
      })
      .expect(200);
    authorToken = loginAuthor.body.accessToken;

    // 2. Commenter
    const regCommenter = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'commenter@example.com',
        name: 'Active Commenter',
        password: 'password123',
      })
      .expect(201);
    commenterId = regCommenter.body.id;

    const loginCommenter = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'commenter@example.com',
        password: 'password123',
      })
      .expect(200);
    commenterToken = loginCommenter.body.accessToken;

    // 3. Other User
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'other_user@example.com',
        name: 'Other User',
        password: 'password123',
      })
      .expect(201);

    const loginOther = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'other_user@example.com',
        password: 'password123',
      })
      .expect(200);
    otherToken = loginOther.body.accessToken;

    // Create an Article by Author
    const artRes = await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Article for Comments Testing',
        description: 'Testing comments functionality',
        body: 'Comments CRD flow detailed content...',
        tagList: ['comments', 'nest'],
      })
      .expect(201);

    articleSlug = artRes.body.slug;
  });

  describe('POST /api/articles/:slug/comments - Add Comments to an Article', () => {
    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${articleSlug}/comments`)
        .send({ body: 'Nice article!' })
        .expect(401);
    });

    it('should return 400 Bad Request when body is empty', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${articleSlug}/comments`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ body: '' })
        .expect(400);
    });

    it('should return 400 Bad Request when body contains only whitespace', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${articleSlug}/comments`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ body: '     ' })
        .expect(400);
    });

    it('should return 400 Bad Request when body exceeds max length (1000)', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${articleSlug}/comments`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ body: 'a'.repeat(1001) })
        .expect(400);
    });

    it('should return 404 Not Found when article does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/articles/non-existent-article-slug/comments')
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ body: 'Nice article!' })
        .expect(404);
    });

    it('should create comment successfully with author profile', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/articles/${articleSlug}/comments`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ body: 'Bài viết rất hay và bổ ích!' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.body).toBe('Bài viết rất hay và bổ ích!');
      expect(res.body.author.id).toBe(commenterId);
      expect(res.body.author.name).toBe('Active Commenter');
      expect(res.body.author.password).toBeUndefined();
      commentId = res.body.id;
    });
  });

  describe('GET /api/articles/:slug/comments - Get Comments from an Article', () => {
    it('should return 404 Not Found when article does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/articles/non-existent-article-slug/comments')
        .expect(404);
    });

    it('should return comments list for unauthenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/articles/${articleSlug}/comments`)
        .expect(200);

      expect(res.body.comments).toBeDefined();
      expect(Array.isArray(res.body.comments)).toBe(true);
      expect(res.body.comments.length).toBe(1);
      expect(res.body.comments[0].id).toBe(commentId);
      expect(res.body.comments[0].author.following).toBe(false);
      expect(res.body.comments[0].author.password).toBeUndefined();
    });

    it('should return comments list with correct following status when user follows commenter', async () => {
      // Author follows commenter
      await request(app.getHttpServer())
        .post(`/api/users/${commenterId}/follow`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      // Author fetches comments
      const res = await request(app.getHttpServer())
        .get(`/api/articles/${articleSlug}/comments`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      expect(res.body.comments.length).toBe(1);
      expect(res.body.comments[0].author.following).toBe(true);
    });
  });

  describe('DELETE /api/articles/:slug/comments/:id - Delete Comment', () => {
    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug}/comments/${commentId}`)
        .expect(401);
    });

    it('should return 403 Forbidden when a different user tries to delete the comment', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug}/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should return 404 Not Found when deleting non-existent comment', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug}/comments/999999`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .expect(404);
    });

    it('should return localized 404 error message when Accept-Language: en is sent', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug}/comments/999999`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .set('Accept-Language', 'en')
        .expect(404);

      expect(res.body.message).toBe('Comment does not exist');
    });

    it('should return 404 Not Found when trying to delete comment of Article A using slug of Article B, and comment must not be deleted', async () => {
      // 1. Create Article B
      const artB = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Article B for cross-article test',
          description: 'Testing cross article comment deletion',
          body: 'Content for article B...',
          tagList: ['test'],
        })
        .expect(201);
      const articleBSlug = artB.body.slug;

      // 2. Try to delete comment of Article A using Article B slug
      await request(app.getHttpServer())
        .delete(`/api/articles/${articleBSlug}/comments/${commentId}`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .expect(404);

      // 3. Verify comment of Article A still exists
      const listA = await request(app.getHttpServer())
        .get(`/api/articles/${articleSlug}/comments`)
        .expect(200);
      expect(listA.body.comments.some((c: any) => c.id === commentId)).toBe(
        true,
      );
    });

    it('should delete comment successfully by the author of the comment', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug}/comments/${commentId}`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .set('Accept-Language', 'vi')
        .expect(200);

      expect(res.body.message).toContain('thành công');

      // Verify comment is removed
      const listRes = await request(app.getHttpServer())
        .get(`/api/articles/${articleSlug}/comments`)
        .expect(200);

      expect(listRes.body.comments.length).toBe(0);
    });
  });
});
