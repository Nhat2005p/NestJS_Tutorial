import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class UpdateArticleDataDto {
  @ApiPropertyOptional({
    example: 'Updated NestJS CRUD API Guide',
    description: 'Tiêu đề bài viết mới',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 'Cập nhật hướng dẫn xây dựng API CRUD với NestJS',
    description: 'Mô tả bài viết mới',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Nội dung cập nhật mới...',
    description: 'Nội dung bài viết mới',
  })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({
    example: ['nestjs', 'v10', 'tutorial'],
    type: [String],
    description: 'Danh sách thẻ tag mới',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagList?: string[];
}

export class UpdateArticleDto {
  @ApiPropertyOptional({ type: UpdateArticleDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateArticleDataDto)
  article?: UpdateArticleDataDto;

  @ApiPropertyOptional({
    example: 'Updated NestJS CRUD API Guide',
    description: 'Tiêu đề bài viết mới',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 'Cập nhật hướng dẫn xây dựng API CRUD với NestJS',
    description: 'Mô tả bài viết mới',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Nội dung cập nhật mới...',
    description: 'Nội dung bài viết mới',
  })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({
    example: ['nestjs', 'v10', 'tutorial'],
    type: [String],
    description: 'Danh sách thẻ tag mới',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagList?: string[];
}
