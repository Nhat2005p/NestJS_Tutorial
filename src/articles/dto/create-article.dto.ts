import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ArticleDataDto {
  @ApiProperty({
    example: 'How to build NestJS CRUD API',
    description: 'Tiêu đề bài viết',
  })
  @IsNotEmpty({ message: 'Tiêu đề bài viết không được để trống' })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'Học cách xây dựng CRUD Articles chuẩn RESTful',
    description: 'Mô tả ngắn gọn bài viết',
  })
  @IsNotEmpty({ message: 'Mô tả bài viết không được để trống' })
  @IsString()
  description: string;

  @ApiProperty({
    example: 'Nội dung chi tiết bài viết với NestJS và TypeORM...',
    description: 'Nội dung bài viết',
  })
  @IsNotEmpty({ message: 'Nội dung bài viết không được để trống' })
  @IsString()
  body: string;

  @ApiPropertyOptional({
    example: ['nestjs', 'typescript', 'backend'],
    type: [String],
    description: 'Danh sách các thẻ tag',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagList?: string[];
}

export class CreateArticleDto {
  @ApiPropertyOptional({ type: ArticleDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ArticleDataDto)
  article?: ArticleDataDto;

  @ApiPropertyOptional({
    example: 'How to build NestJS CRUD API',
    description: 'Tiêu đề bài viết',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 'Học cách xây dựng CRUD Articles chuẩn RESTful',
    description: 'Mô tả ngắn gọn bài viết',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Nội dung chi tiết bài viết với NestJS và TypeORM...',
    description: 'Nội dung bài viết',
  })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({
    example: ['nestjs', 'typescript', 'backend'],
    type: [String],
    description: 'Danh sách các thẻ tag',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagList?: string[];
}
