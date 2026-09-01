import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { QuerySimilarTicketsDto } from './dto/query-similar-tickets.dto';
import { SuggestClassificationDto } from './dto/suggest-classification.dto';
import { SimilarTicketsResponseDto } from './dto/similar-ticket.dto';
import {
  PaginatedTicketsDto,
  TicketResponseDto,
} from './dto/ticket-response.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiCreatedResponse({ type: TicketResponseDto })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets with filters and pagination' })
  @ApiOkResponse({ type: PaginatedTicketsDto })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryTicketsDto) {
    return this.ticketsService.findAll(user, query);
  }

  @Get(':id/similar')
  @ApiOperation({
    summary: 'Find similar tickets by meaning (not saved)',
  })
  @ApiOkResponse({ type: SimilarTicketsResponseDto })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiBadGatewayResponse({
    description: 'Embedding service is unavailable or returned invalid vectors',
  })
  findSimilar(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuerySimilarTicketsDto,
  ) {
    return this.ticketsService.findSimilar(user, id, query.limit ?? 5);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ticket by id' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ticketsService.findOne(user, id);
  }

  @Post(':id/suggest-classification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suggest category and priority for a ticket (not saved)',
  })
  @ApiOkResponse({ type: SuggestClassificationDto })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiBadGatewayResponse({
    description:
      'Classification service is unavailable or returned invalid JSON',
  })
  suggestClassification(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ticketsService.suggestClassification(user, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a ticket' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ticket (admin only)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.remove(id);
  }
}
