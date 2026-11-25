import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ArticleAuthorResponseDto } from '../../articles/serializers/article.serializer';

export class CommentResponseDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'Bài viết rất hay và chi tiết!' })
  @Expose()
  body: string;

  @ApiProperty({ example: '2026-11-23T08:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2026-11-23T08:00:00.000Z' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ type: ArticleAuthorResponseDto })
  @Expose()
  @Type(() => ArticleAuthorResponseDto)
  author: ArticleAuthorResponseDto;
}

export class CommentsResponseDto {
  @ApiProperty({ type: [CommentResponseDto] })
  @Expose()
  @Type(() => CommentResponseDto)
  comments: CommentResponseDto[];
}
