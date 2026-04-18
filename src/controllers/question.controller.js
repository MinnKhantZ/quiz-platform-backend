import * as questionService from "../services/question.service.js";

export async function add(req, res, next) {
  try {
    const question = await questionService.addQuestion(req.params.quizId, req.user.id, req.body);
    res.status(201).json(question);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const question = await questionService.updateQuestion(req.params.id, req.user.id, req.body);
    res.json(question);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await questionService.deleteQuestion(req.params.id, req.user.id);
    res.json({ message: "Question deleted" });
  } catch (err) {
    next(err);
  }
}

export async function reorder(req, res, next) {
  try {
    await questionService.reorderQuestions(req.params.quizId, req.user.id, req.body.questionIds);
    res.json({ message: "Questions reordered" });
  } catch (err) {
    next(err);
  }
}
