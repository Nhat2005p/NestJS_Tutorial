import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
  ) {}

  async createAttachment(
    file: Express.Multer.File,
    attachableType: string,
    attachableId: number,
  ): Promise<Attachment> {
    const url = `/public/avatars/${file.filename}`;

    const attachment = this.attachmentRepository.create({
      attachableType,
      attachableId,
      url,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
    });

    return this.attachmentRepository.save(attachment);
  }

  async findByAttachable(
    attachableType: string,
    attachableId: number,
  ): Promise<Attachment | null> {
    return this.attachmentRepository.findOne({
      where: { attachableType, attachableId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByAttachables(
    attachableType: string,
    attachableIds: number[],
  ): Promise<Map<number, Attachment>> {
    if (!attachableIds || attachableIds.length === 0) {
      return new Map();
    }

    const attachments = await this.attachmentRepository.find({
      where: {
        attachableType,
        attachableId: In(attachableIds),
      },
      order: { createdAt: 'DESC' },
    });

    const map = new Map<number, Attachment>();
    for (const attachment of attachments) {
      if (!map.has(attachment.attachableId)) {
        map.set(attachment.attachableId, attachment);
      }
    }
    return map;
  }

  async findById(id: string): Promise<Attachment | null> {
    return this.attachmentRepository.findOne({ where: { id } });
  }
}
