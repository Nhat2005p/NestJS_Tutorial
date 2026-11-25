import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';
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
    @Optional()
    private readonly i18n?: I18nService,
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

  /**
   * Batch load favorites, follows, and avatars for an array of articles to avoid N+1 queries.
   */
  private async buildArticleResponses(
    articles: Article[],
    currentUserId?: number,
  ): Promise<ArticleResponseDto[]> {
    if (!articles || articles.length === 0) {
      return [];
    }

    const articleIds = articles.map((a) => a.id);
    const authorIds = Array.from(new Set(articles.map((a) => a.authorId)));

    // 1. Batch query favorites for current user
    const favoritedArticleIdSet = new Set<number>();
    if (currentUserId && articleIds.length > 0) {
      const favorites = await this.favoriteRepository.find({
        where: {
          userId: currentUserId,
          articleId: In(articleIds),
        },
      });
      favorites.forEach((fav) => favoritedArticleIdSet.add(fav.articleId));
    }

    // 2. Batch query follows for current user
    const followedAuthorIdSet = new Set<number>();
    if (currentUserId && authorIds.length > 0) {
      const follows = await this.followRepository.find({
        where: {
          followerId: currentUserId,
          followingId: In(authorIds),
        },
      });
      follows.forEach((f) => followedAuthorIdSet.add(f.followingId));
    }

    // 3. Batch query avatars for authors
    const authorAvatarMap = await this.attachmentsService.findByAttachables(
      'User',
      authorIds,
    );

    return articles.map((article) => {
      const favorited = favoritedArticleIdSet.has(article.id);
      const following =
        currentUserId && article.authorId && currentUserId !== article.authorId
          ? followedAuthorIdSet.has(article.authorId)
          : false;
      const avatar = authorAvatarMap.get(article.authorId) || null;

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
    });
  }

  async findArticleEntity(identifier: string | number): Promise<Article> {
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
      const message = this.i18n
        ? this.i18n.t('article.not_found')
        : `Bài viết '${identifier}' không tồn tại`;
      throw new NotFoundException(message);
    }

    return article;
  }

  async create(
    authorId: number,
    createArticleDto: CreateArticleDto,
  ): Promise<ArticleResponseDto> {
    if (!createArticleDto.title || !createArticleDto.body) {
      throw new BadRequestException(
        'Vui lòng điền đầy đủ tiêu đề và nội dung bài viết',
      );
    }

    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException('Tác giả không tồn tại');
    }

    const slug = this.generateSlug(createArticleDto.title);

    const article = this.articleRepository.create({
      slug,
      title: createArticleDto.title,
      description: createArticleDto.description,
      body: createArticleDto.body,
      tagList: createArticleDto.tagList || [],
      favoritesCount: 0,
      authorId,
      author,
    });

    const savedArticle = await this.articleRepository.save(article);
    const [result] = await this.buildArticleResponses([savedArticle], authorId);
    return result;
  }

  async findAll(
    query: QueryArticlesDto,
    currentUserId?: number,
  ): Promise<ArticlesResponseDto> {
    const qb = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .orderBy('article.createdAt', 'DESC');

    // So khớp nguyên tag: CONCAT(',', article.tag_list, ',') LIKE '%,tag,%'
    // Chống trường hợp tag 'java' khớp nhầm 'javascript'
    if (query.tag) {
      const cleanTag = query.tag.trim();
      const isSqlite =
        this.articleRepository.manager.connection.options.type === 'sqljs';

      if (isSqlite) {
        qb.andWhere("',' || article.tag_list || ',' LIKE :tagPattern", {
          tagPattern: `%,${cleanTag},%`,
        });
      } else {
        qb.andWhere("CONCAT(',', article.tag_list, ',') LIKE :tagPattern", {
          tagPattern: `%,${cleanTag},%`,
        });
      }
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

    const formattedArticles = await this.buildArticleResponses(
      articles,
      currentUserId,
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

    const formattedArticles = await this.buildArticleResponses(
      articles,
      currentUserId,
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
    const [result] = await this.buildArticleResponses([article], currentUserId);
    return result;
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

    if (updateArticleDto.title !== undefined) {
      article.title = updateArticleDto.title;
      article.slug = this.generateSlug(updateArticleDto.title);
    }
    if (updateArticleDto.description !== undefined) {
      article.description = updateArticleDto.description;
    }
    if (updateArticleDto.body !== undefined) {
      article.body = updateArticleDto.body;
    }
    if (updateArticleDto.tagList !== undefined) {
      article.tagList = updateArticleDto.tagList;
    }

    const savedArticle = await this.articleRepository.save(article);
    const [result] = await this.buildArticleResponses(
      [savedArticle],
      currentUserId,
    );
    return result;
  }

  async delete(
    identifier: string | number,
    currentUserId: number,
  ): Promise<{ message: string }> {
    const article = await this.findArticleEntity(identifier);

    if (article.authorId !== currentUserId) {
      throw new ForbiddenException('Bạn không có quyền xóa bài viết này');
    }

    // onDelete: 'CASCADE' trong migration đã tự động dọn dẹp các bản ghi trong article_favorites
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

    // Bọc trong transaction và tăng bằng increment().
    // Nếu gặp lỗi trùng unique key (ER_DUP_ENTRY / SQLITE_CONSTRAINT) thì coi như đã favorite (idempotent).
    await this.articleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        try {
          const fav = transactionalEntityManager.create(ArticleFavorite, {
            userId: currentUserId,
            articleId: article.id,
          });
          await transactionalEntityManager.save(ArticleFavorite, fav);

          await transactionalEntityManager.increment(
            Article,
            { id: article.id },
            'favoritesCount',
            1,
          );
        } catch (error: any) {
          const isDuplicate =
            error.code === 'ER_DUP_ENTRY' ||
            error.code === 'SQLITE_CONSTRAINT' ||
            error.message?.includes('Duplicate') ||
            error.message?.includes('UNIQUE') ||
            error.message?.includes('constraint');

          if (!isDuplicate) {
            throw error;
          }
        }
      },
    );

    const updatedArticle = await this.findArticleEntity(identifier);
    const [result] = await this.buildArticleResponses(
      [updatedArticle],
      currentUserId,
    );
    return result;
  }

  async unfavorite(
    identifier: string | number,
    currentUserId: number,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntity(identifier);

    // Bọc trong transaction và giảm favoritesCount an toàn (không âm)
    await this.articleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const deleteResult = await transactionalEntityManager.delete(
          ArticleFavorite,
          {
            userId: currentUserId,
            articleId: article.id,
          },
        );

        if (deleteResult.affected && deleteResult.affected > 0) {
          await transactionalEntityManager
            .createQueryBuilder()
            .update(Article)
            .set({
              favoritesCount: () =>
                'CASE WHEN favorites_count > 0 THEN favorites_count - 1 ELSE 0 END',
            })
            .where('id = :id', { id: article.id })
            .execute();
        }
      },
    );

    const updatedArticle = await this.findArticleEntity(identifier);
    const [result] = await this.buildArticleResponses(
      [updatedArticle],
      currentUserId,
    );
    return result;
  }
}
