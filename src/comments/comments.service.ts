import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { In, Repository } from 'typeorm';
import { Article } from '../articles/entities/article.entity';
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
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly attachmentsService: AttachmentsService,
  ) {}

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
      });
    } else {
      article = await this.articleRepository.findOne({
        where: { slug: String(identifier) },
      });
    }

    if (!article) {
      throw new NotFoundException(`Bài viết '${identifier}' không tồn tại`);
    }

    return article;
  }

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
    authorId: number,
    createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    if (!createCommentDto.body || createCommentDto.body.trim() === '') {
      throw new BadRequestException('Nội dung bình luận không được để trống');
    }

    const article = await this.findArticleEntity(slugOrId);

    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException('Tác giả không tồn tại');
    }

    const comment = this.commentRepository.create({
      body: createCommentDto.body.trim(),
      articleId: article.id,
      article,
      authorId,
      author,
    });

    const savedComment = await this.commentRepository.save(comment);
    const [result] = await this.buildCommentResponses([savedComment], authorId);
    return result;
  }

  async findAll(
    slugOrId: string | number,
    currentUserId?: number,
  ): Promise<CommentsResponseDto> {
    const article = await this.findArticleEntity(slugOrId);

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
    const article = await this.findArticleEntity(slugOrId);

    const comment = await this.commentRepository.findOne({
      where: { id: commentId, articleId: article.id },
    });

    if (!comment) {
      throw new NotFoundException('Bình luận không tồn tại');
    }

    if (comment.authorId !== currentUserId) {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    await this.commentRepository.remove(comment);

    return {
      message: 'Xóa bình luận thành công',
    };
  }
}
