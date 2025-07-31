// AI Assistant JavaScript for Interview Preparation
class AIAssistant {
    constructor() {
        this.apiKey = 'AIzaSyAVvFfPblCbj2mrMXyIVlPhX4scm9bNkKo';
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        this.currentQuiz = null;
        this.quizAnswers = [];
        this.currentQuestionIndex = 0;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // AI Assistant button
        const aiBtn = document.getElementById('ai-assistant-btn');
        const aiModal = document.getElementById('ai-assistant-modal');
        const closeAiBtn = document.getElementById('close-ai-modal-btn');
        const generateMcqBtn = document.getElementById('generate-mcq-btn');
        const generateTheoryBtn = document.getElementById('generate-theory-btn');

        // Results modal
        const resultsModal = document.getElementById('ai-results-modal');
        const closeResultsBtn = document.getElementById('close-results-btn');

        // MCQ quiz modal
        const mcqModal = document.getElementById('mcq-quiz-modal');
        const closeMcqBtn = document.getElementById('close-mcq-btn');
        const nextQuestionBtn = document.getElementById('next-question-btn');
        const submitQuizBtn = document.getElementById('submit-quiz-btn');
        const restartQuizBtn = document.getElementById('restart-quiz-btn');

        // Event listeners
        aiBtn?.addEventListener('click', () => this.openAIModal());
        closeAiBtn?.addEventListener('click', () => this.closeAIModal());
        generateMcqBtn?.addEventListener('click', () => this.generateMCQ());
        generateTheoryBtn?.addEventListener('click', () => this.generateTheory());
        closeResultsBtn?.addEventListener('click', () => this.closeResultsModal());
        closeMcqBtn?.addEventListener('click', () => this.closeMcqModal());
        nextQuestionBtn?.addEventListener('click', () => this.nextQuestion());
        submitQuizBtn?.addEventListener('click', () => this.submitQuiz());
        restartQuizBtn?.addEventListener('click', () => this.restartQuiz());

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === aiModal) this.closeAIModal();
            if (e.target === resultsModal) this.closeResultsModal();
            if (e.target === mcqModal) this.closeMcqModal();
        });
    }

    openAIModal() {
        const modal = document.getElementById('ai-assistant-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('topic-input')?.focus();
        }
    }

    closeAIModal() {
        const modal = document.getElementById('ai-assistant-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.getElementById('topic-input').value = '';
        }
    }

    closeResultsModal() {
        document.getElementById('ai-results-modal')?.classList.add('hidden');
    }

    closeMcqModal() {
        document.getElementById('mcq-quiz-modal')?.classList.add('hidden');
        this.currentQuiz = null;
        this.quizAnswers = [];
        this.currentQuestionIndex = 0;
    }

    async generateMCQ() {
        const topic = document.getElementById('topic-input')?.value.trim();
        if (!topic) {
            alert('Please enter a topic');
            return;
        }

        this.closeAIModal();
        this.showLoading('Generating MCQ questions...');

        try {
            const prompt = `Generate 12 high-quality multiple-choice questions for ${topic} interview preparation. 
            Each question should have 4 options (A, B, C, D) with one correct answer.
            Focus on practical, interview-relevant questions that test real-world knowledge.
            
            IMPORTANT: Return ONLY valid JSON, no markdown, no additional text.
            
            JSON format:
            {
                "questions": [
                    {
                        "question": "Question text",
                        "options": ["Option A", "Option B", "Option C", "Option D"],
                        "correctAnswer": 0,
                        "explanation": "Brief explanation"
                    }
                ]
            }
            Make questions progressively challenging and relevant to job interviews.`;

            const response = await this.callGeminiAPI(prompt);
            const quizData = this.parseJSONResponse(response);
            
            if (quizData && quizData.questions) {
                this.startMCQQuiz(quizData.questions, topic);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error generating MCQ:', error);
            alert('Error generating questions. Please try again with a more specific topic.');
        }
    }

    async generateTheory() {
        const topic = document.getElementById('topic-input')?.value.trim();
        if (!topic) {
            alert('Please enter a topic');
            return;
        }

        this.closeAIModal();
        this.showLoading('Generating theory questions...');

        try {
            const prompt = `Generate 4-5 comprehensive theory questions for ${topic} interview preparation.
            Each question should be followed by a detailed, interview-ready answer.
            Focus on conceptual understanding and practical application.
            
            IMPORTANT: Return ONLY valid JSON, no markdown, no additional text.
            
            JSON format:
            {
                "questions": [
                    {
                        "question": "Question text",
                        "answer": "Detailed interview-ready answer"
                    }
                ]
            }
            Make questions relevant to senior-level interviews and include real-world scenarios.`;

            const response = await this.callGeminiAPI(prompt);
            const theoryData = this.parseJSONResponse(response);
            
            if (theoryData && theoryData.questions) {
                this.displayTheoryQuestions(theoryData.questions, topic);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error generating theory:', error);
            alert('Error generating theory questions. Please try again with a more specific topic.');
        }
    }

    async callGeminiAPI(prompt) {
        const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    parseJSONResponse(responseText) {
        try {
            // Clean the response text to extract JSON
            let cleanText = responseText.trim();
            
            // Remove markdown code blocks if present
            cleanText = cleanText.replace(/```json\s*/g, '').replace(/\s*```/g, '');
            cleanText = cleanText.replace(/```\s*/g, '');
            
            // Remove any leading/trailing non-JSON characters
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            }
            
            // Try to parse the cleaned JSON
            return JSON.parse(cleanText);
        } catch (error) {
            console.error('Error parsing JSON:', error);
            console.error('Raw response:', responseText);
            
            // Try to fix common JSON issues
            try {
                // Fix trailing commas
                let fixedText = responseText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                return JSON.parse(fixedText);
            } catch (fixError) {
                console.error('Could not fix JSON:', fixError);
                return null;
            }
        }
    }

    showLoading(message) {
        const resultsModal = document.getElementById('ai-results-modal');
        const resultsBody = document.getElementById('ai-results-body');
        const resultsTitle = document.getElementById('results-title');
        
        if (resultsModal && resultsBody && resultsTitle) {
            resultsTitle.textContent = 'Processing...';
            resultsBody.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div class="loading-spinner" style="
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #007bff;
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    "></div>
                    <p>${message}</p>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            resultsModal.classList.remove('hidden');
        }
    }

    startMCQQuiz(questions, topic) {
        this.currentQuiz = questions;
        this.quizAnswers = new Array(questions.length).fill(null);
        this.currentQuestionIndex = 0;

        document.getElementById('ai-results-modal')?.classList.add('hidden');
        
        const mcqModal = document.getElementById('mcq-quiz-modal');
        const topicTitle = document.getElementById('mcq-topic-title');
        
        if (topicTitle) topicTitle.textContent = topic;
        
        this.displayQuestion();
        mcqModal?.classList.remove('hidden');
    }

    displayQuestion() {
        if (!this.currentQuiz || this.currentQuestionIndex >= this.currentQuiz.length) return;

        const question = this.currentQuiz[this.currentQuestionIndex];
        const quizBody = document.getElementById('mcq-quiz-body');
        const questionCounter = document.getElementById('question-counter');
        const progressFill = document.getElementById('progress-fill');
        const nextBtn = document.getElementById('next-question-btn');
        const submitBtn = document.getElementById('submit-quiz-btn');

        if (questionCounter) {
            questionCounter.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.currentQuiz.length}`;
        }

        if (progressFill) {
            const progress = ((this.currentQuestionIndex + 1) / this.currentQuiz.length) * 100;
            progressFill.style.width = `${progress}%`;
        }

        if (quizBody) {
            quizBody.innerHTML = `
                <div class="quiz-question">
                    <div class="question-text">${this.currentQuestionIndex + 1}. ${question.question}</div>
                    <div class="quiz-options">
                        ${question.options.map((option, index) => `
                            <div class="quiz-option ${this.quizAnswers[this.currentQuestionIndex] === index ? 'selected' : ''}" 
                                 data-index="${index}">
                                ${String.fromCharCode(65 + index)}. ${option}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            // Add click listeners to options
            quizBody.querySelectorAll('.quiz-option').forEach(option => {
                option.addEventListener('click', (e) => this.selectAnswer(parseInt(e.target.dataset.index)));
            });
        }

        // Show/hide appropriate buttons
        const isLastQuestion = this.currentQuestionIndex === this.currentQuiz.length - 1;
        if (nextBtn) nextBtn.style.display = isLastQuestion ? 'none' : 'inline-block';
        if (submitBtn) submitBtn.style.display = isLastQuestion ? 'inline-block' : 'none';
    }

    selectAnswer(answerIndex) {
        this.quizAnswers[this.currentQuestionIndex] = answerIndex;
        
        // Update visual selection
        document.querySelectorAll('.quiz-option').forEach((option, index) => {
            option.classList.toggle('selected', index === answerIndex);
        });
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.length - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
        }
    }

    submitQuiz() {
        const results = this.calculateResults();
        this.displayQuizResults(results);
    }

    calculateResults() {
        let correct = 0;
        const results = this.currentQuiz.map((question, index) => ({
            question: question.question,
            userAnswer: this.quizAnswers[index],
            correctAnswer: question.correctAnswer,
            options: question.options,
            explanation: question.explanation,
            isCorrect: this.quizAnswers[index] === question.correctAnswer
        }));

        correct = results.filter(r => r.isCorrect).length;
        
        return {
            total: this.currentQuiz.length,
            correct,
            incorrect: this.currentQuiz.length - correct,
            percentage: Math.round((correct / this.currentQuiz.length) * 100),
            results
        };
    }

    displayQuizResults(results) {
        const mcqModal = document.getElementById('mcq-quiz-modal');
        const resultsModal = document.getElementById('ai-results-modal');
        const resultsBody = document.getElementById('ai-results-body');
        const resultsTitle = document.getElementById('results-title');

        if (resultsTitle) resultsTitle.textContent = 'Quiz Results';
        
        if (resultsBody) {
            resultsBody.innerHTML = `
                <div style="text-align: center; margin-bottom: 30px;">
                    <h3 style="color: ${results.percentage >= 80 ? '#28a745' : results.percentage >= 60 ? '#ffc107' : '#dc3545'};">
                        Score: ${results.correct}/${results.total} (${results.percentage}%)
                    </h3>
                    <p style="font-size: 1.1rem; color: #666;">
                        ${results.percentage >= 80 ? 'Excellent! You\'re interview-ready!' : 
                          results.percentage >= 60 ? 'Good job! Keep practicing.' : 
                          'Keep studying! You\'ll get there.'}
                    </p>
                </div>
                <div class="results-breakdown">
                    ${results.results.map((result, index) => `
                        <div style="margin-bottom: 20px; padding: 15px; border-radius: 10px; 
                                    background: ${result.isCorrect ? '#d4edda' : '#f8d7da'}; 
                                    border-left: 4px solid ${result.isCorrect ? '#28a745' : '#dc3545'}">
                            <strong>Q${index + 1}: ${result.question}</strong><br>
                            <div style="margin: 10px 0;">
                                <strong>Your answer:</strong> ${String.fromCharCode(65 + result.userAnswer)}. ${result.options[result.userAnswer]}<br>
                                <strong>Correct answer:</strong> ${String.fromCharCode(65 + result.correctAnswer)}. ${result.options[result.correctAnswer]}<br>
                                <strong>Explanation:</strong> ${result.explanation}
                            </div>
                            ${result.isCorrect ? 
                                '<span style="color: #28a745;">✓ Correct</span>' : 
                                '<span style="color: #dc3545;">✗ Incorrect</span>'}
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="aiAssistant.restartQuiz()" class="quiz-btn">Try Again</button>
                </div>
            `;
        }

        mcqModal?.classList.add('hidden');
        resultsModal?.classList.remove('hidden');
    }

    restartQuiz() {
        document.getElementById('ai-results-modal')?.classList.add('hidden');
        this.openAIModal();
    }

    displayTheoryQuestions(questions, topic) {
        document.getElementById('ai-results-modal')?.classList.remove('hidden');
        
        const resultsBody = document.getElementById('ai-results-body');
        const resultsTitle = document.getElementById('results-title');

        if (resultsTitle) resultsTitle.textContent = `${topic} - Theory Questions`;
        
        if (resultsBody) {
            resultsBody.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3>Interview-Ready Theory Questions for ${topic}</h3>
                    <p>Study these questions and answers to prepare for your interview.</p>
                </div>
                <div class="theory-questions">
                    ${questions.map((q, index) => `
                        <div class="theory-question">
                            <h3>Q${index + 1}: ${q.question}</h3>
                            <div class="theory-answer">
                                <strong>Answer:</strong><br>
                                ${q.answer.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
}

// Initialize AI Assistant when DOM is loaded
let aiAssistant;
document.addEventListener('DOMContentLoaded', () => {
    aiAssistant = new AIAssistant();
});

// Make AI Assistant globally accessible
window.aiAssistant = aiAssistant;