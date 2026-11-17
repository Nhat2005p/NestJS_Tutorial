import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AttachmentResponseDto } from '../../users/serializers/user-profile.serializer';

export class ArticleAuthorResponseDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'Minh Nhat' })
  @Expose()
  name: string;

  @ApiPropertyOptional({ example: 'NestJS Developer' })
  @Expose()
  bio?: string;

  @ApiPropertyOptional({ type: AttachmentResponseDto })
  @Expose()
  @Type(() => AttachmentResponseDto)
  avatar?: AttachmentResponseDto;

  @ApiProperty({ example: false })
  @Expose()
  following: boolean;
}

export class ArticleResponseDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'how-to-build-nestjs-crud-api-a1b2c3d4' })
  @Expose()
  slug: string;

  @ApiProperty({ example: 'How to build NestJS CRUD API' })
  @Expose()
  title: string;

  @ApiProperty({ example: 'Học cách xây dựng CRUD Articles chuẩn RESTful' })
  @Expose()
  description: string;

  @ApiProperty({
    example: 'Nội dung chi tiết bài viết với NestJS và TypeORM...',
  })
  @Expose()
  body: string;

  @ApiProperty({ example: ['nestjs', 'typescript', 'backend'], type: [String] })
  @Expose()
  tagList: string[];

  @ApiProperty({ example: '2026-11-17T09:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2026-11-17T09:00:00.000Z' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: false })
  @Expose()
  favorited: boolean;

  @ApiProperty({ example: 0 })
  @Expose()
  favoritesCount: number;

  @ApiProperty({ type: ArticleAuthorResponseDto })
  @Expose()
  @Type(() => ArticleAuthorResponseDto)
  author: ArticleAuthorResponseDto;
}

export class ArticlesResponseDto {
  @ApiProperty({ type: [ArticleResponseDto] })
  @Expose()
  @Type(() => ArticleResponseDto)
  articles: ArticleResponseDto[];

  @ApiProperty({ example: 10 })
  @Expose()
  articlesCount: number;
}
