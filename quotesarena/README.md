# Quotes Arena: AI-Generated Quote Comparison

Quotes Arena is a web application that allows users to compare short, AI-generated quotes side-by-side and vote for their preferred one. It also tracks and displays the performance (win percentages) of the different AI models that generated these quotes.

## What it does

The tool presents users with a pair of quotes, each generated by a different AI model (e.g., ChatGPT, Gemini, Claude, Grok). Users can then vote on which quote they find better or declare it a tie. The application keeps track of these votes to calculate and display win statistics for each AI model.

Key Features:

- **Side-by-Side Comparison:** Displays two quotes from different AI models for direct comparison.
- **Voting System:** Users can vote for "A is Better," "B is Better," or "Tie."
- **Randomized Presentation:** Quotes are selected randomly, and their display order (left/right) is also randomized to avoid positional bias.
- **Persistent Results:** Voting data is saved in the browser's `localStorage`, so results persist across sessions.
- **Performance Statistics:** A "View Results" tab shows the win percentage for each AI model based on user votes, along with the total number of comparisons (games) that model has been in.

## Use Cases

- **Evaluating AI-Generated Content:** Provides a simple platform for subjectively evaluating the quality and appeal of short text snippets generated by different LLMs.
- **Finding Inspiration:** Users can discover and compare different phrasings or ideas on a similar theme (though the current quotes are general).
- **Casual Engagement:** A simple and engaging way to interact with AI-generated content.
- **Informal A/B Testing:** Can be used informally to see which style of AI-generated quote resonates more with users.

## How It Works

1.  **Data Loading:**

    - Quotes and their originating AI models are loaded from a local `quotes.csv` file.
    - Voting results are loaded from `localStorage` if they exist; otherwise, a new results structure is initialized.

2.  **Quote Comparison Tab:**

    - Two quotes from different AI models are randomly selected and displayed in cards.
    - The user clicks one of the three voting buttons ("A is Better," "B is Better," "Tie").
    - The vote is recorded, updating the win/loss/tie counts for the pair of models involved.
    - The results are saved back to `localStorage`.
    - A new random pair of quotes is immediately displayed for the next comparison.

3.  **View Results Tab:**
    - This tab calculates the overall win percentage for each model.
    - For a given model, its "wins" are tallied based on direct votes and inferred from votes where it was the other model in a pair.
    - The win percentage is displayed as: `ModelName: XX.X% (Y games)`.

The application uses D3.js for loading the CSV data and Bootstrap for styling. All interactions and data storage are client-side.
