import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AttachmentsService } from '../attachments/attachments.service';
import { Follow } from '../users/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { ArticlesService } from './articles.service';
import { ArticleFavorite } from './entities/article-favorite.entity';
import { Article } from './entities/article.entity';

describe('ArticlesService', () => {
  let service: ArticlesService;

  const mockAuthor: User = {
    id: 1,
    name: 'Minh Nhat',
    email: 'nhat@example.com',
    password: 'hashedPassword',
    bio: 'NestJS Developer',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOtherUser: User = {
    id: 2,
    name: 'Trainer Binh',
    email: 'binh@example.com',
    password: 'hashedPassword',
    bio: 'Mentor',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockArticle: Article = {
    id: 1,
    slug: 'how-to-build-nestjs-crud-api-12345678',
    title: 'How to build NestJS CRUD API',
    description: 'Học cách xây dựng CRUD Articles chuẩn RESTful',
    body: 'Nội dung chi tiết...',
    tagList: ['nestjs', 'typescript'],
    favoritesCount: 0,
    authorId: 1,
    author: mockAuthor,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTransactionalManager = {
    create: jest.fn().mockImplementation((entity, data) => data),
    save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    increment: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    query: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    }),
  };

  const mockArticleRepository = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest
      .fn()
      .mockImplementation((art) => Promise.resolve({ ...art, id: 1 })),
    findOne: jest.fn(),
    remove: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn(),
    manager: {
      transaction: jest
        .fn()
        .mockImplementation((callback) => callback(mockTransactionalManager)),
      connection: {
        options: {
          type: 'mysql',
        },
      },
    },
  };

  const mockFavoriteRepository = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((fav) => Promise.resolve(fav)),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockFollowRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };

  const mockAttachmentsService = {
    findByAttachable: jest.fn().mockResolvedValue(null),
    findByAttachables: jest.fn().mockResolvedValue(new Map()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepository,
        },
        {
          provide: getRepositoryToken(ArticleFavorite),
          useValue: mockFavoriteRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Follow),
          useValue: mockFollowRepository,
        },
        {
          provide: AttachmentsService,
          useValue: mockAttachmentsService,
        },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  describe('create', () => {
    it('should create an article successfully with slug and author', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockAuthor);

      const result = await service.create(1, {
        title: 'How to build NestJS CRUD API',
        description: 'Học cách xây dựng CRUD Articles chuẩn RESTful',
        body: 'Nội dung chi tiết...',
        tagList: ['nestjs', 'typescript'],
      });

      expect(result.title).toBe('How to build NestJS CRUD API');
      expect(result.slug).toContain('how-to-build-nestjs-crud-api');
      expect(result.author.id).toBe(1);
      expect(mockArticleRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if title or body is missing', async () => {
      await expect(
        service.create(1, {
          title: '',
          description: 'desc',
          body: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findBySlugOrId', () => {
    it('should return article by slug', async () => {
      mockArticleRepository.findOne.mockResolvedValue(mockArticle);

      const result = await service.findBySlugOrId(
        'how-to-build-nestjs-crud-api-12345678',
      );
      expect(result.id).toBe(1);
      expect(result.title).toBe('How to build NestJS CRUD API');
    });

    it('should throw NotFoundException if article not found', async () => {
      mockArticleRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySlugOrId('non-existent-slug')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update article when user is author', async () => {
      mockArticleRepository.findOne.mockResolvedValue({ ...mockArticle });

      const result = await service.update(
        'how-to-build-nestjs-crud-api-12345678',
        1,
        {
          title: 'Updated Title',
          description: 'Updated Description',
        },
      );

      expect(result.title).toBe('Updated Title');
      expect(mockArticleRepository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is NOT the author', async () => {
      mockArticleRepository.findOne.mockResolvedValue({ ...mockArticle });

      await expect(
        service.update('how-to-build-nestjs-crud-api-12345678', 2, {
          title: 'Hacked Title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should delete article when user is author', async () => {
      mockArticleRepository.findOne.mockResolvedValue({ ...mockArticle });

      const result = await service.delete(
        'how-to-build-nestjs-crud-api-12345678',
        1,
      );

      expect(result.message).toContain('thành công');
      expect(mockArticleRepository.remove).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is NOT the author', async () => {
      mockArticleRepository.findOne.mockResolvedValue({ ...mockArticle });

      await expect(
        service.delete('how-to-build-nestjs-crud-api-12345678', 2),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('favorite & unfavorite', () => {
    it('should favorite an article inside transaction', async () => {
      mockArticleRepository.findOne.mockResolvedValue({
        ...mockArticle,
        favoritesCount: 1,
      });

      const result = await service.favorite(
        'how-to-build-nestjs-crud-api-12345678',
        2,
      );

      expect(mockArticleRepository.manager.transaction).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('should unfavorite an article inside transaction', async () => {
      mockArticleRepository.findOne.mockResolvedValue({
        ...mockArticle,
        favoritesCount: 0,
      });

      const result = await service.unfavorite(
        'how-to-build-nestjs-crud-api-12345678',
        2,
      );

      expect(mockArticleRepository.manager.transaction).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });
  });

  describe('findAll', () => {
    it('should match whole tag with commas in query builder', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockArticle]),
      };
      mockArticleRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findAll({ tag: 'java' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LIKE :tagPattern'),
        { tagPattern: '%,java,%' },
      );
      expect(result.articlesCount).toBe(1);
    });
  });

  describe('findFeed', () => {
    it('should return empty list if user follows nobody', async () => {
      mockFollowRepository.find.mockResolvedValue([]);

      const result = await service.findFeed(1, {});
      expect(result.articles).toEqual([]);
      expect(result.articlesCount).toBe(0);
    });
  });
});
