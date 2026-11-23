import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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

  const mockArticleRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockFollowRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockAttachmentsService = {
    findByAttachables: jest.fn().mockResolvedValue(new Map()),
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
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepository,
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

    service = module.get<CommentsService>(CommentsService);
  });

  describe('create', () => {
    it('should create comment successfully', async () => {
      mockArticleRepository.findOne.mockResolvedValue(mockArticle);
      mockUserRepository.findOne.mockResolvedValue(mockCommenter);

      const result = await service.create(mockArticle.slug, 2, {
        body: 'Great article!',
      });

      expect(result.id).toBe(1);
      expect(result.body).toBe('Great article!');
      expect(result.author.id).toBe(2);
      expect(mockCommentRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if body is empty', async () => {
      await expect(
        service.create(mockArticle.slug, 2, { body: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if article not found', async () => {
      mockArticleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('invalid-slug', 2, { body: 'Hello' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return comments for article', async () => {
      mockArticleRepository.findOne.mockResolvedValue(mockArticle);
      mockCommentRepository.find.mockResolvedValue([mockComment]);

      const result = await service.findAll(mockArticle.slug, 1);

      expect(result.comments.length).toBe(1);
      expect(result.comments[0].body).toBe('Great article!');
      expect(result.comments[0].author.id).toBe(2);
    });

    it('should throw NotFoundException if article not found', async () => {
      mockArticleRepository.findOne.mockResolvedValue(null);

      await expect(service.findAll('invalid-slug')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete comment when user is author', async () => {
      mockArticleRepository.findOne.mockResolvedValue(mockArticle);
      mockCommentRepository.findOne.mockResolvedValue({ ...mockComment });

      const result = await service.delete(mockArticle.slug, 1, 2);

      expect(result.message).toContain('thành công');
      expect(mockCommentRepository.remove).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is NOT the author', async () => {
      mockArticleRepository.findOne.mockResolvedValue(mockArticle);
      mockCommentRepository.findOne.mockResolvedValue({ ...mockComment });

      await expect(service.delete(mockArticle.slug, 1, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if comment not found', async () => {
      mockArticleRepository.findOne.mockResolvedValue(mockArticle);
      mockCommentRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(mockArticle.slug, 999, 2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
