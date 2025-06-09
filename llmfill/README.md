# LLM Fill-in-the-Blank

Inspired by Google's [Fill in the Blank](https://pair.withgoogle.com/explorables/fill-in-the-blank/) experiment, this tool lets you hide any word in a sentence and see how different language models predict the missing text. As you blank a word, the app asks the model to fill it in and shows the top token probabilities coloured from white (likely) to red (unlikely).

1. Type or edit the sentence in the text box.
2. Each word or punctuation mark appears as a button below it.
3. Click a button to blank the word. A request is sent to the selected model and the word is replaced with the model's guess.
4. The probabilities for the predicted tokens are shown in tables beside each other.

You can supply your own API key, base URL and model. The data is stored in your browser using `saveform`.
