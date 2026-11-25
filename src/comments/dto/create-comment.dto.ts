import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { COMMENT_CONSTRAINTS } from '../constants/comment.constants';

export class CreateCommentDto {
  @ApiProperty({
    example: 'Bài viết rất hay và chi tiết!',
    description: 'Nội dung bình luận',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Nội dung bình luận không được để trống' })
  @IsString({ message: 'Nội dung bình luận phải là chuỗi ký tự' })
  @MaxLength(COMMENT_CONSTRAINTS.BODY_MAX_LENGTH, {
    message: `Nội dung bình luận không được vượt quá ${COMMENT_CONSTRAINTS.BODY_MAX_LENGTH} ký tự`,
  })
  body: string;
}
