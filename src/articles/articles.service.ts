import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AttachmentsService } from '../attachments/attachments.service';
import { Follow } from '../users/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { QueryFeedDto } from './dto/query-feed.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleFavorite } from './entities/article-favorite.entity';
import { Article } from './entities/article.entity';
import {
  ArticleResponseDto,
  ArticlesResponseDto,
} from './serializers/article.serializer';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(ArticleFavorite)
    private readonly favoriteRepository: Repository<ArticleFavorite>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  private generateSlug(title: string): string {
    const baseSlug = title
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const suffix = uuidv4().slice(0, 8);
    return `${baseSlug || 'article'}-${suffix}`;
  }

  private async buildArticleResponse(
    article: Article,
    currentUserId?: number,
  ): Promise<ArticleResponseDto> {
    let favorited = false;
    if (currentUserId) {
      const fav = await this.favoriteRepository.findOne({
        where: { userId: currentUserId, articleId: article.id },
      });
      favorited = !!fav;
    }

    let following = false;
    if (
      currentUserId &&
      article.authorId &&
      currentUserId !== article.authorId
    ) {
      const follow = await this.followRepository.findOne({
        where: { followerId: currentUserId, followingId: article.authorId },
      });
      following = !!follow;
    }

    const avatar = await this.attachmentsService.findByAttachable(
      'User',
      article.authorId,
    );

    return plainToInstance(
      ArticleResponseDto,
      {
        ...article,
        tagList: article.tagList || [],
        favorited,
        author: {
          id: article.author?.id || article.authorId,
          name: article.author?.name || '',
          bio: article.author?.bio,
          avatar,
          following,
        },
      },
      { excludeExtraneousValues: true },
    );
  }

  private async findArticleEntity(
    identifier: string | number,
  ): Promise<Article> {
    const isNum =
      typeof identifier === 'number' ||
      (!isNaN(Number(identifier)) &&
        !isNaN(parseFloat(identifier as string)) &&
        !String(identifier).includes('-'));

    let article: Article | null = null;
    if (isNum) {
      article = await this.articleRepository.findOne({
        where: [{ id: Number(identifier) }, { slug: String(identifier) }],
        relations: ['author'],
      });
    } else {
      article = await this.articleRepository.findOne({
        where: { slug: String(identifier) },
        relations: ['author'],
      });
    }

    if (!article) {
      throw new NotFoundException(`Bài viết '${identifier}' không tồn tại`);
    }

    return article;
  }

  async create(
    authorId: number,
    createArticleDto: CreateArticleDto,
  ): Promise<ArticleResponseDto> {
    const data = createArticleDto.article || createArticleDto;

    if (!data.title || !data.description || !data.body) {
      throw new BadRequestException(
        'Vui lòng điền đầy đủ tiêu đề, mô tả và nội dung bài viết',
      );
    }

    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException('Tác giả không tồn tại');
    }

    const slug = this.generateSlug(data.title);

    const article = this.articleRepository.create({
      slug,
      title: data.title,
      description: data.description,
      body: data.body,
      tagList: data.tagList || [],
      favoritesCount: 0,
      authorId,
      author,
    });

    const savedArticle = await this.articleRepository.save(article);
    return this.buildArticleResponse(savedArticle, authorId);
  }

  async findAll(
    query: QueryArticlesDto,
    currentUserId?: number,
  ): Promise<ArticlesResponseDto> {
    const qb = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .orderBy('article.createdAt', 'DESC');

    if (query.tag) {
      qb.andWhere('article.tag_list LIKE :tag', { tag: `%${query.tag}%` });
    }

    if (query.author) {
      const isNum = !isNaN(Number(query.author));
      qb.andWhere(
        '(author.name = :authorName OR author.email = :authorName' +
          (isNum ? ' OR author.id = :authorId)' : ')'),
        {
          authorName: query.author,
          authorId: isNum ? Number(query.author) : -1,
        },
      );
    }

    if (query.favorited) {
      qb.innerJoin(
        ArticleFavorite,
        'fav',
        'fav.article_id = article.id',
      ).innerJoin(
        User,
        'favUser',
        'favUser.id = fav.user_id AND (favUser.name = :favName OR favUser.email = :favName)',
        { favName: query.favorited },
      );
    }

    const total = await qb.getCount();
    const articles = await qb
      .skip(query.offset || 0)
      .take(query.limit || 20)
      .getMany();

    const formattedArticles = await Promise.all(
      articles.map((article) =>
        this.buildArticleResponse(article, currentUserId),
      ),
    );

    return {
      articles: formattedArticles,
      articlesCount: total,
    };
  }

  async findFeed(
    currentUserId: number,
    query: QueryFeedDto,
  ): Promise<ArticlesResponseDto> {
    const follows = await this.followRepository.find({
      where: { followerId: currentUserId },
    });

    if (follows.length === 0) {
      return {
        articles: [],
        articlesCount: 0,
      };
    }

    const followingIds = follows.map((f) => f.followingId);

    const qb = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .where('article.author_id IN (:...followingIds)', { followingIds })
      .orderBy('article.createdAt', 'DESC');

    const total = await qb.getCount();
    const articles = await qb
      .skip(query.offset || 0)
      .take(query.limit || 20)
      .getMany();

    const formattedArticles = await Promise.all(
      articles.map((article) =>
        this.buildArticleResponse(article, currentUserId),
      ),
    );

    return {
      articles: formattedArticles,
      articlesCount: total,
    };
  }

  async findBySlugOrId(
    identifier: string | number,
    currentUserId?: number,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntity(identifier);
    return this.buildArticleResponse(article, currentUserId);
  }

  async update(
    identifier: string | number,
    currentUserId: number,
    updateArticleDto: UpdateArticleDto,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntity(identifier);

    if (article.authorId !== currentUserId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài viết này');
    }

    const data = updateArticleDto.article || updateArticleDto;

    if (data.title !== undefined) {
      article.title = data.title;
      article.slug = this.generateSlug(data.title);
    }
    if (data.description !== undefined) {
      article.description = data.description;
    }
    if (data.body !== undefined) {
      article.body = data.body;
    }
    if (data.tagList !== undefined) {
      article.tagList = data.tagList;
    }

    const savedArticle = await this.articleRepository.save(article);
    return this.buildArticleResponse(savedArticle, currentUserId);
  }

  async delete(
    identifier: string | number,
    currentUserId: number,
  ): Promise<{ message: string }> {
    const article = await this.findArticleEntity(identifier);

    if (article.authorId !== currentUserId) {
      throw new ForbiddenException('Bạn không có quyền xóa bài viết này');
    }

    await this.favoriteRepository.delete({ articleId: article.id });
    await this.articleRepository.remove(article);

    return {
      message: 'Xóa bài viết thành công',
    };
  }

  async favorite(
    identifier: string | number,
    currentUserId: number,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntity(identifier);

    const existing = await this.favoriteRepository.findOne({
      where: { userId: currentUserId, articleId: article.id },
    });

    if (!existing) {
      const fav = this.favoriteRepository.create({
        userId: currentUserId,
        articleId: article.id,
      });
      await this.favoriteRepository.save(fav);

      article.favoritesCount += 1;
      await this.articleRepository.save(article);
    }

    return this.buildArticleResponse(article, currentUserId);
  }

  async unfavorite(
    identifier: string | number,
    currentUserId: number,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntity(identifier);

    const existing = await this.favoriteRepository.findOne({
      where: { userId: currentUserId, articleId: article.id },
    });

    if (existing) {
      await this.favoriteRepository.remove(existing);

      article.favoritesCount = Math.max(0, article.favoritesCount - 1);
      await this.articleRepository.save(article);
    }

    return this.buildArticleResponse(article, currentUserId);
  }
}
