import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateArticleDto {
  @ApiPropertyOptional({
    example: 'Updated NestJS CRUD API Guide',
    description: 'Tiêu đề bài viết mới',
  })
  @IsOptional()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống nếu được cập nhật' })
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  title?: string;

  @ApiPropertyOptional({
    example: 'Cập nhật hướng dẫn xây dựng API CRUD với NestJS',
    description: 'Mô tả bài viết mới',
  })
  @IsOptional()
  @IsNotEmpty({ message: 'Mô tả không được để trống nếu được cập nhật' })
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Nội dung cập nhật mới...',
    description: 'Nội dung bài viết mới',
  })
  @IsOptional()
  @IsNotEmpty({ message: 'Nội dung không được để trống nếu được cập nhật' })
  @IsString({ message: 'Nội dung phải là chuỗi' })
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
