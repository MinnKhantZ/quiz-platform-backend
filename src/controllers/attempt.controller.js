import * as attemptService from "../services/attempt.service.js";

export async function start(req, res, next) {
  try {
    const result = await attemptService.startAttempt(req.params.quizId, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function submit(req, res, next) {
  try {
    const result = await attemptService.submitAttempt(req.params.id, req.user.id, req.body.answers);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const attempt = await attemptService.getAttempt(req.params.id, req.user.id);
    res.json(attempt);
  } catch (err) {
    next(err);
  }
}

export async function history(req, res, next) {
  try {
    const attempts = await attemptService.getStudentHistory(req.user.id, req.query.quizId);
    res.json(attempts);
  } catch (err) {
    next(err);
  }
}
