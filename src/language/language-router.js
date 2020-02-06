const express = require('express')
const LanguageService = require('./language-service')
const { requireAuth } = require('../middleware/jwt-auth')
const jsonBodyParser = express.json();

const languageRouter = express.Router()

languageRouter
  .use(requireAuth)
  .use(async (req, res, next) => {
    try {
      const language = await LanguageService.getUsersLanguage(
        req.app.get('db'),
        req.user.id,
      )

      if (!language)
        return res.status(404).json({
          error: `You don't have any languages`,
        })

      req.language = language
      next()
    } catch (error) {
      next(error)
    }
  })

languageRouter
  .get('/', async (req, res, next) => {
    try {
      const words = await LanguageService.getLanguageWords(
        req.app.get('db'),
        req.language.id,
      )
      res.json({
        language: req.language,
        words,
      })
      next()
    } catch (error) {
      next(error)
    }
  })

languageRouter
  .get('/head', async (req, res, next) => {
    try {

      const head = await LanguageService.getLanguageHead(
        req.app.get('db'),
        req.language.id,
      )

      res.status(200).json({
        currentWord: head.original,
        totalScore: req.language.total_score,
        wordCorrectCount: head.correct_count,
        wordIncorrectCount: head.incorrect_count
      });
      next();
    } catch (error) {
      next(error)
    }
  });

languageRouter
  .post('/guess', jsonBodyParser, async (req, res, next) => {
    try {
      const { guess } = req.body;

      if (!req.body.guess) {
        return res.status(400).json({ error: `Missing 'guess' in request body` });
      }

      const words = await LanguageService.getLanguageWords(
        req.app.get('db'),
        req.language.id
      );

      if (guess.toLowerCase() === words[0].translation.toLowerCase()) {

        const allEqual = words.every(word => {
          word.memory_value === 2
        })

        console.log('this is boolean', allEqual);
        if (allEqual) {
          words[0].memory_value = 1
          console.log('it got resetted')
        } else {
          words[0].memory_value = words[0].memory_value * 2;
          console.log('it got multiplied')
        }
        words[0].correct_count++;

        req.language.total_score++;
      } else {
        words[0].incorrect_count++;
        words[0].memory_value = 1;
      }

      await LanguageService.updateTotalScore(
        req.app.get('db'),
        req.language.id,
        req.language.total_score
      );

      //convert array into a Linked list
      let linkedList = LanguageService.convertLinkedList(words);

      //determine positioning using insert methods and save it into a variable
      let currentWord = linkedList.head.value;
      if (linkedList.head.value.memory_value) {
        linkedList.remove(words[0]);
        linkedList.insertLast(words[0]);
      }
      else {
        linkedList.remove(words[0])
        linkedList.insertAt(
          words[0].memory_value,
          words[0])
      }

      //once the linked list is orderd, convert linked list into an array and re-order

      let sortedList = linkedList.displayList();
      //make a database call to update the totalscore and word

      //loop through each index (checking for existing next value)
      //update the next property value for each word
      for (let i = 0; i < sortedList.length; i++) {
        if (sortedList[i + 1]) {
          sortedList[i].next = sortedList[i + 1].id;
        } else {
          sortedList[i].next = null;
        }
        await LanguageService.updateWord(
          req.app.get('db'),
          sortedList[i].id,
          sortedList[i]);
      }

      results = {
        currentWord: currentWord.original,
        nextWord: sortedList[0].original,
        wordCorrectCount: sortedList[0].correct_count,
        wordIncorrectCount: sortedList[0].incorrect_count,
        totalScore: req.language.total_score,
        answer: words[0].translation,
        guess: guess,
        isCorrect: (guess.toLowerCase() === words[0].translation.toLowerCase())
      };

      return res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  });

module.exports = languageRouter
