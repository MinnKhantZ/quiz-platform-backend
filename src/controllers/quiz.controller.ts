import { Request, Response, NextFunction } from "express";
import * as quizService from "../services/quiz.service.js";

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const quiz = await quizService.createQuiz(req.user!.id, req.body);
    res.status(201).json(quiz);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isTeacher = req.user?.role === "TEACHER";
    const quizzes = await quizService.getQuizzes(
      isTeacher ? { teacherId: req.user!.id } : { published: true }
    );
    res.json(quizzes);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isTeacher = req.user?.role === "TEACHER";
    const quiz = await quizService.getQuizById(req.params.id, isTeacher);
    res.json(quiz);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const quiz = await quizService.updateQuiz(req.params.id, req.user!.id, req.body);
    res.json(quiz);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await quizService.deleteQuiz(req.params.id, req.user!.id);
    res.json({ message: "Quiz deleted" });
  } catch (err) {
    next(err);
  }
}
