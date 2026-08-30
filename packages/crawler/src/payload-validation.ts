import type {
  Article,
  ArticleDetails,
  Paste,
  Post,
  PostDetails,
  ProblemSummary,
  Reply,
  UserSummary,
} from "@lgjs/types";

import { UpstreamPayloadError } from "./error.js";
import {
  expectFiniteNumber,
  expectPositiveInteger,
  expectRecord,
  expectString,
} from "./http.js";

function expectBoolean(value: unknown, endpoint: string) {
  if (typeof value !== "boolean") {
    throw new UpstreamPayloadError(endpoint, "expected a boolean");
  }
}

function expectNonNegativeInteger(value: unknown, endpoint: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new UpstreamPayloadError(endpoint, "expected a non-negative integer");
  }
}

function expectNullableString(
  value: unknown,
  endpoint: string,
  maximum: number,
) {
  if (value !== null && value !== undefined) {
    expectString(value, endpoint, maximum);
  }
}

export function validateUserSummary(
  value: unknown,
  endpoint: string,
): UserSummary {
  const user = expectRecord(value, endpoint);
  expectPositiveInteger(user.uid, `${endpoint}.uid`);
  expectString(user.name, `${endpoint}.name`, 128);
  expectNullableString(user.slogan, `${endpoint}.slogan`, 4_096);
  expectNullableString(user.badge, `${endpoint}.badge`, 128);
  expectBoolean(user.isAdmin, `${endpoint}.isAdmin`);
  expectBoolean(user.isBanned, `${endpoint}.isBanned`);
  if (user.isRoot !== undefined)
    expectBoolean(user.isRoot, `${endpoint}.isRoot`);
  expectString(user.color, `${endpoint}.color`, 32);
  expectNonNegativeInteger(user.ccfLevel, `${endpoint}.ccfLevel`);
  expectNonNegativeInteger(user.xcpcLevel, `${endpoint}.xcpcLevel`);
  expectNullableString(user.background, `${endpoint}.background`, 4_096);
  return user as unknown as UserSummary;
}

function validateProblemSummary(
  value: unknown,
  endpoint: string,
): ProblemSummary {
  const problem = expectRecord(value, endpoint);
  expectString(problem.pid, `${endpoint}.pid`, 64);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(problem.pid as string)) {
    throw new UpstreamPayloadError(endpoint, "invalid problem ID");
  }
  expectString(problem.title, `${endpoint}.title`, 512);
  if (problem.difficulty !== null && problem.difficulty !== undefined) {
    expectFiniteNumber(problem.difficulty, `${endpoint}.difficulty`);
  }
  return problem as unknown as ProblemSummary;
}

function validateForum(value: unknown, endpoint: string) {
  const forum = expectRecord(value, endpoint);
  expectString(forum.name, `${endpoint}.name`, 128);
  expectString(forum.slug, `${endpoint}.slug`, 128);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(forum.slug as string)) {
    throw new UpstreamPayloadError(endpoint, "invalid forum slug");
  }
  if (forum.type !== null && forum.type !== undefined)
    expectFiniteNumber(forum.type, `${endpoint}.type`);
  expectNullableString(forum.color, `${endpoint}.color`, 64);
  if (forum.problem !== null && forum.problem !== undefined)
    validateProblemSummary(forum.problem, `${endpoint}.problem`);
}

function validateReplyCommon(value: unknown, endpoint: string) {
  const reply = expectRecord(value, endpoint);
  expectPositiveInteger(reply.id, `${endpoint}.id`);
  expectPositiveInteger(reply.time, `${endpoint}.time`);
  validateUserSummary(reply.author, `${endpoint}.author`);
  return reply;
}

export function validateReply(value: unknown, endpoint: string): Reply {
  const reply = validateReplyCommon(value, endpoint);
  expectString(reply.content, `${endpoint}.content`, 2 * 1024 * 1024);
  return reply as unknown as Reply;
}

function validatePostCommon(value: unknown, endpoint: string) {
  const post = expectRecord(value, endpoint);
  expectPositiveInteger(post.id, `${endpoint}.id`);
  expectPositiveInteger(post.time, `${endpoint}.time`);
  expectNonNegativeInteger(post.replyCount, `${endpoint}.replyCount`);
  expectBoolean(post.topped, `${endpoint}.topped`);
  expectBoolean(post.locked, `${endpoint}.locked`);
  validateUserSummary(post.author, `${endpoint}.author`);
  validateForum(post.forum, `${endpoint}.forum`);
  if (post.recentReply !== null && post.recentReply !== undefined) {
    const recentReply = validateReplyCommon(
      post.recentReply,
      `${endpoint}.recentReply`,
    );
    if (recentReply.content !== undefined)
      expectString(
        recentReply.content,
        `${endpoint}.recentReply.content`,
        2 * 1024 * 1024,
      );
  }
  return post;
}

export function validatePost(value: unknown, endpoint: string): Post {
  return validatePostCommon(value, endpoint) as unknown as Post;
}

export function validatePostDetails(
  value: unknown,
  endpoint: string,
): PostDetails {
  const post = validatePostCommon(value, endpoint);
  expectString(post.title, `${endpoint}.title`, 512);
  expectString(post.content, `${endpoint}.content`, 2 * 1024 * 1024);
  if (post.pinnedReply !== null && post.pinnedReply !== undefined)
    validateReply(post.pinnedReply, `${endpoint}.pinnedReply`);
  return post as unknown as PostDetails;
}

function validateArticleCommon(value: unknown, endpoint: string) {
  const article = expectRecord(value, endpoint);
  expectString(article.lid, `${endpoint}.lid`, 8);
  if (!/^[a-z0-9]{8}$/.test(article.lid as string)) {
    throw new UpstreamPayloadError(endpoint, "invalid article ID");
  }
  expectPositiveInteger(article.time, `${endpoint}.time`);
  validateUserSummary(article.author, `${endpoint}.author`);
  expectNonNegativeInteger(article.upvote, `${endpoint}.upvote`);
  expectNonNegativeInteger(article.replyCount, `${endpoint}.replyCount`);
  expectNonNegativeInteger(article.favorCount, `${endpoint}.favorCount`);
  expectFiniteNumber(article.status, `${endpoint}.status`);
  if (article.collection !== null && article.collection !== undefined) {
    const collection = expectRecord(
      article.collection,
      `${endpoint}.collection`,
    );
    expectPositiveInteger(collection.id, `${endpoint}.collection.id`);
    expectString(collection.name, `${endpoint}.collection.name`, 256);
  }
  return article;
}

export function validateArticle(value: unknown, endpoint: string): Article {
  return validateArticleCommon(value, endpoint) as unknown as Article;
}

export function validateArticleDetails(
  value: unknown,
  endpoint: string,
): ArticleDetails {
  const article = validateArticleCommon(value, endpoint);
  expectString(article.title, `${endpoint}.title`, 512);
  expectString(article.content, `${endpoint}.content`, 2 * 1024 * 1024);
  expectFiniteNumber(article.category, `${endpoint}.category`);
  expectFiniteNumber(article.promoteStatus, `${endpoint}.promoteStatus`);
  expectNullableString(article.adminNote, `${endpoint}.adminNote`, 4_096);
  if (article.solutionFor !== null && article.solutionFor !== undefined)
    validateProblemSummary(article.solutionFor, `${endpoint}.solutionFor`);
  return article as unknown as ArticleDetails;
}

export function validatePaste(value: unknown, endpoint: string): Paste {
  const paste = expectRecord(value, endpoint);
  expectString(paste.id, `${endpoint}.id`, 8);
  if (!/^[a-z0-9]{8}$/.test(paste.id as string)) {
    throw new UpstreamPayloadError(endpoint, "invalid paste ID");
  }
  expectPositiveInteger(paste.time, `${endpoint}.time`);
  expectBoolean(paste.public, `${endpoint}.public`);
  if (paste.public === true)
    expectString(paste.data, `${endpoint}.data`, 2 * 1024 * 1024);
  else expectNullableString(paste.data, `${endpoint}.data`, 2 * 1024 * 1024);
  validateUserSummary(paste.user, `${endpoint}.user`);
  return paste as unknown as Paste;
}
