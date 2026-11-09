// About: what Fluentra is, the learning science behind it, and how it's built.
import { h } from "../ui.js";
import * as data from "../data.js";
import { fmt } from "../ui.js";

export async function render(root) {
  const [words, phrases, grammar, convs, sounds] = await Promise.all([data.words(), data.get("phrases"), data.get("grammar"), data.get("conversations"), data.get("sounds")]);
  root.className = "page prose";
  root.append(
    h("h1", {}, "About Fluentra"),
    h("p", { style: "margin-top:16px" }, "Fluentra is a free web app for intermediate learners who want to become fluent in American English. It focuses on what moves you from understanding English to actually using it: a big, useful vocabulary you can recall on the spot, an ear for the sounds of English, grammar you meet in context, and speaking out loud from day one."),
    h("h2", {}, "What's inside"),
    h("ul", {},
      h("li", {}, `${fmt(words.length)} words from intermediate to near-native, each with a plain-English meaning, an example sentence, similar words and a casual equivalent.`),
      h("li", {}, `${fmt(phrases.length)} phrase patterns for opinions, requests, stories and small talk.`),
      h("li", {}, `${sounds.sounds.length} sounds of American English and ${sounds.contrasts.length} sound pairs for ear training.`),
      h("li", {}, `${grammar.length} grammar points with quizzes, and ${convs.length} everyday conversations to practice speaking.`)),
    h("h2", {}, "How it helps you remember"),
    h("ul", {},
      h("li", {}, h("b", {}, "Spaced repetition. "), "Each word comes back right before you'd forget it, at growing intervals: tomorrow, in three days, in a week, in a month."),
      h("li", {}, h("b", {}, "Recall first. "), "Reviews show the meaning and a sentence with a gap. Pulling the word out of memory, even when it's hard, makes it stick far better than rereading."),
      h("li", {}, h("b", {}, "Words in context. "), "Every word lives in a real sentence, and you can watch real people say it in video clips."),
      h("li", {}, h("b", {}, "Sound first. "), "Minimal pairs (ship or sheep) train your ear for sounds your first language may not have."),
      h("li", {}, h("b", {}, "Speak early. "), "Conversation practice checks what you say with speech recognition, so speaking becomes a habit, not a test."),
      h("li", {}, h("b", {}, "Produce, don't reread. "), "In Respond you see a real situation and build the reply yourself, on its own review schedule."),
      h("li", {}, h("b", {}, "Beat the fluency illusion. "), "Understanding a fast line isn't saying it. Shadowing makes you repeat at the speaker's speed, then use each idiom in your own sentence."),
      h("li", {}, h("b", {}, "Forget a little, on purpose. "), "Hands-free recall uses words you saw two or more days ago, when they're on the tip of your tongue."),
      h("li", {}, h("b", {}, "Mix it up. "), "Tense mix shuffles past, present and future so you practice choosing, not repeating one rule."),
      h("li", {}, h("b", {}, "Explain it simply. "), "If you can't explain a word to a child, you don't own it yet. Where you get stuck becomes a gap to work on."),
      h("li", {}, h("b", {}, "Make it yours. "), "Write a sentence from your own life with each word. It comes back with the word in your reviews.")),
    h("h2", {}, "Private by design"),
    h("p", {}, "There's no account and no server storing your data. Progress is saved in your browser, voices and speech recognition run on your device, and you can export or erase everything from the Progress page. Fluentra also works offline once it has loaded."),
    h("h2", {}, "How it's built"),
    h("p", {}, "Plain JavaScript modules, HTML and CSS with no frameworks and no build step. The learning logic (scheduling, session planning, answer checking, ear training) is pure and covered by automated tests that run on every change. It's an installable progressive web app that meets accessibility basics: keyboard use, visible focus, screen-reader labels, reduced motion, and light and dark themes."),
    h("p", {}, "Designed and built by Ali Alassaf, with Claude Code as an AI pair programmer."),
    h("p", { style: "margin-top:28px" }, h("a", { class: "btn primary", href: "#/today" }, "Start learning")),
  );
}
