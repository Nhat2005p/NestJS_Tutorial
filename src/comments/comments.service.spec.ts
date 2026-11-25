import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { ArticlesService } from '../articles/articles.service';
import { Article } from '../articles/entities/article.entity';
import { AttachmentsService } from '../attachments/attachments.service';
import { Follow } from '../users/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

describe('CommentsService', () => {
  let service: CommentsService;

  const mockUser: User = {
    id: 1,
    name: 'Author User',
    email: 'author@example.com',
    password: 'hashedPassword',
    bio: 'NestJS Developer',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCommenter: User = {
    id: 2,
    name: 'Commenter User',
    email: 'commenter@example.com',
    password: 'hashedPassword',
    bio: 'Reader',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockArticle: Article = {
    id: 10,
    slug: 'test-article-slug-12345678',
    title: 'Test Article Title',
    description: 'Test Description',
    body: 'Test Body Content',
    tagList: ['nestjs'],
    favoritesCount: 0,
    authorId: 1,
    author: mockUser,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockComment: Comment = {
    id: 1,
    body: 'Great article!',
    articleId: 10,
    article: mockArticle,
    authorId: 2,
    author: mockCommenter,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCommentRepository = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((c) => Promise.resolve({ ...c, id: 1 })),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue({}),
  };

  const mockArticlesService = {
    findArticleEntity: jest.fn(),
  };

  const mockFollowRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockAttachmentsService = {
    findByAttachables: jest.fn().mockResolvedValue(new Map()),
  };

  const mockI18nService = {
    t: jest.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockCommentRepository,
        },
        {
          provide: ArticlesService,
          useValue: mockArticlesService,
        },
        {
          provide: getRepositoryToken(Follow),
          useValue: mockFollowRepository,
        },
        {
          provide: AttachmentsService,
          useValue: mockAttachmentsService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('create', () => {
    it('should create comment successfully with author entity directly', async () => {
      mockArticlesService.findArticleEntity.mockResolvedValue(mockArticle);

      const result = await service.create(mockArticle.slug, mockCommenter, {
        body: 'Great article!',
      });

      expect(result.id).toBe(1);
      expect(result.body).toBe('Great article!');
      expect(result.author.id).toBe(2);
      expect(mockArticlesService.findArticleEntity).toHaveBeenCalledWith(
        mockArticle.slug,
      );
      expect(mockCommentRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if article not found', async () => {
      mockArticlesService.findArticleEntity.mockRejectedValue(
        new NotFoundException('Article not found'),
      );

      await expect(
        service.create('invalid-slug', mockCommenter, {
          body: 'Hello',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return comments for article', async () => {
      mockArticlesService.findArticleEntity.mockResolvedValue(mockArticle);
      mockCommentRepository.find.mockResolvedValue([mockComment]);

      const result = await service.findAll(mockArticle.slug, 1);

      expect(result.comments.length).toBe(1);
      expect(result.comments[0].body).toBe('Great article!');
      expect(result.comments[0].author.id).toBe(2);
    });

    it('should throw NotFoundException if article not found', async () => {
      mockArticlesService.findArticleEntity.mockRejectedValue(
        new NotFoundException('Article not found'),
      );

      await expect(service.findAll('invalid-slug')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete comment when user is author', async () => {
      mockArticlesService.findArticleEntity.mockResolvedValue(mockArticle);
      mockCommentRepository.findOne.mockResolvedValue({ ...mockComment });

      const result = await service.delete(mockArticle.slug, 1, 2);

      expect(mockI18nService.t).toHaveBeenCalledWith('comment.delete_success');
      expect(result.message).toBe('comment.delete_success');
      expect(mockCommentRepository.remove).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is NOT the author', async () => {
      mockArticlesService.findArticleEntity.mockResolvedValue(mockArticle);
      mockCommentRepository.findOne.mockResolvedValue({ ...mockComment });

      await expect(service.delete(mockArticle.slug, 1, 999)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockI18nService.t).toHaveBeenCalledWith(
        'comment.forbidden_delete',
      );
    });

    it('should throw NotFoundException if comment not found in article', async () => {
      mockArticlesService.findArticleEntity.mockResolvedValue(mockArticle);
      mockCommentRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(mockArticle.slug, 999, 2)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockI18nService.t).toHaveBeenCalledWith('comment.not_found');
    });
  });
});
