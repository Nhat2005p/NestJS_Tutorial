import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';
import { ArticlesService } from '../articles/articles.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { Follow } from '../users/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';
import {
  CommentResponseDto,
  CommentsResponseDto,
} from './serializers/comment.serializer';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly articlesService: ArticlesService,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly attachmentsService: AttachmentsService,
    private readonly i18n: I18nService,
  ) {}

  private async buildCommentResponses(
    comments: Comment[],
    currentUserId?: number,
  ): Promise<CommentResponseDto[]> {
    if (comments.length === 0) {
      return [];
    }

    const authorIds = Array.from(
      new Set(comments.map((c) => c.authorId).filter(Boolean)),
    );

    // 1. Batch query follow status
    const followingAuthorIdSet = new Set<number>();
    if (currentUserId && authorIds.length > 0) {
      const follows = await this.followRepository.find({
        where: {
          followerId: currentUserId,
          followingId: In(authorIds),
        },
      });
      follows.forEach((f) => followingAuthorIdSet.add(f.followingId));
    }

    // 2. Batch query avatars for authors
    const authorAvatarMap = await this.attachmentsService.findByAttachables(
      'User',
      authorIds,
    );

    // 3. Map comments to CommentResponseDto
    return comments.map((comment) => {
      const avatar = authorAvatarMap.get(comment.authorId) || null;
      const following = currentUserId
        ? followingAuthorIdSet.has(comment.authorId)
        : false;

      return plainToInstance(
        CommentResponseDto,
        {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          author: {
            id: comment.author?.id || comment.authorId,
            name: comment.author?.name || '',
            bio: comment.author?.bio,
            avatar: avatar
              ? {
                  id: avatar.id,
                  url: avatar.url,
                  fileName: avatar.fileName,
                  fileType: avatar.fileType,
                  fileSize: avatar.fileSize,
                }
              : undefined,
            following,
          },
        },
        { excludeExtraneousValues: true },
      );
    });
  }

  async create(
    slugOrId: string | number,
    author: User,
    createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const article = await this.articlesService.findArticleEntity(slugOrId);

    const comment = this.commentRepository.create({
      body: createCommentDto.body,
      articleId: article.id,
      article,
      authorId: author.id,
      author,
    });

    const savedComment = await this.commentRepository.save(comment);
    const [result] = await this.buildCommentResponses(
      [savedComment],
      author.id,
    );
    return result;
  }

  async findAll(
    slugOrId: string | number,
    currentUserId?: number,
  ): Promise<CommentsResponseDto> {
    const article = await this.articlesService.findArticleEntity(slugOrId);

    const comments = await this.commentRepository.find({
      where: { articleId: article.id },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });

    const formattedComments = await this.buildCommentResponses(
      comments,
      currentUserId,
    );

    return {
      comments: formattedComments,
    };
  }

  async delete(
    slugOrId: string | number,
    commentId: number,
    currentUserId: number,
  ): Promise<{ message: string }> {
    const article = await this.articlesService.findArticleEntity(slugOrId);

    const comment = await this.commentRepository.findOne({
      where: { id: commentId, articleId: article.id },
    });

    if (!comment) {
      throw new NotFoundException(this.i18n.t('comment.not_found'));
    }

    if (comment.authorId !== currentUserId) {
      throw new ForbiddenException(this.i18n.t('comment.forbidden_delete'));
    }

    await this.commentRepository.remove(comment);

    return {
      message: this.i18n.t('comment.delete_success'),
    };
  }
}
