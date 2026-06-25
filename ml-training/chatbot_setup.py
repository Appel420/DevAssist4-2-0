import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments, DataCollatorForLanguageModeling
from datasets import load_dataset
import os
import json

# --- Configuration ---
MODEL_NAME = "microsoft/DialoGPT-medium"  # Better for chat than GPT-2
MAX_SEQUENCE_LENGTH = 512
TRAIN_BATCH_SIZE = 4
NUM_TRAIN_EPOCHS = 3
OUTPUT_DIR = "./ustreambot_model"
LOGGING_DIR = "./logs"
LEARNING_RATE = 5e-5
WEIGHT_DECAY = 0.01

class ChatbotTrainer:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        
    def setup_model(self):
        """Load and configure the model and tokenizer"""
        print(f"Loading model and tokenizer for: {MODEL_NAME}")
        
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        
        # Set pad_token for generation
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
            self.model.config.pad_token_id = self.model.config.eos_token_id
            
        print("Model and Tokenizer loaded successfully.")
        
    def prepare_dataset(self):
        """Load and preprocess training data"""
        print("Loading dataset...")
        
        # Use a conversational dataset for better chat performance
        try:
            dataset = load_dataset("microsoft/DialoGPT-medium", split="train[:1000]")  # Small subset for demo
        except:
            # Fallback to a simpler dataset
            dataset = load_dataset("wikitext", "wikitext-2-raw-v1", split="train[:1000]")
            
        print("Dataset loaded.")
        
        def preprocess_function(examples):
            # Handle different dataset structures
            text_column = examples.get("text", examples.get("dialogue", examples.get("conversation", None)))
            
            if text_column is None:
                # Create simple conversational format
                text_column = [f"Human: Hello Bot: Hi there! How can I help you today?"] * len(examples.get(list(examples.keys())[0], []))
            
            return self.tokenizer(
                text_column, 
                truncation=True, 
                padding="max_length", 
                max_length=MAX_SEQUENCE_LENGTH
            )
        
        print("Preprocessing dataset...")
        tokenized_dataset = dataset.map(
            preprocess_function, 
            batched=True, 
            remove_columns=dataset.column_names
        )
        print("Dataset preprocessed.")
        
        return tokenized_dataset
        
    def train_model(self, dataset):
        """Train the chatbot model"""
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer, 
            mlm=False
        )
        
        training_args = TrainingArguments(
            output_dir=OUTPUT_DIR,
            per_device_train_batch_size=TRAIN_BATCH_SIZE,
            num_train_epochs=NUM_TRAIN_EPOCHS,
            save_steps=500,
            save_total_limit=2,
            logging_dir=LOGGING_DIR,
            report_to="none",
            learning_rate=LEARNING_RATE,
            weight_decay=WEIGHT_DECAY,
            logging_steps=100,
        )
        
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=dataset,
            data_collator=data_collator,
        )
        
        print("Starting training...")
        trainer.train()
        print("Training complete!")
        
        # Save the model
        print(f"Saving model to {OUTPUT_DIR}...")
        self.model.save_pretrained(OUTPUT_DIR)
        self.tokenizer.save_pretrained(OUTPUT_DIR)
        print("Model saved successfully.")
        
    def chat_with_bot(self, prompt):
        """Generate chat response"""
        # Ensure model is loaded
        if self.model is None:
            if os.path.exists(OUTPUT_DIR):
                print("Loading saved model...")
                self.model = AutoModelForCausalLM.from_pretrained(OUTPUT_DIR)
                self.tokenizer = AutoTokenizer.from_pretrained(OUTPUT_DIR)
            else:
                print("No trained model found. Please train first.")
                return "Model not available. Please train the model first."
        
        # Format prompt for DialoGPT
        formatted_prompt = f"Human: {prompt} Bot:"
        
        inputs = self.tokenizer.encode(formatted_prompt, return_tensors="pt")
        
        with torch.no_grad():
            outputs = self.model.generate(
                inputs,
                max_length=inputs.shape[1] + 50,
                num_return_sequences=1,
                pad_token_id=self.tokenizer.eos_token_id,
                do_sample=True,
                top_k=50,
                top_p=0.95,
                temperature=0.7,
            )
        
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        # Extract only the bot's response
        bot_response = response.split("Bot:")[-1].strip()
        
        return bot_response if bot_response else "I'm not sure how to respond to that."

def main():
    """Main training and testing function"""
    trainer = ChatbotTrainer()
    
    # Setup model
    trainer.setup_model()
    
    # Prepare dataset
    dataset = trainer.prepare_dataset()
    
    # Train model
    trainer.train_model(dataset)
    
    # Test the chatbot
    print("\n--- Testing Chatbot ---")
    test_prompts = [
        "Hello, how are you?",
        "What can you help me with?",
        "Tell me about programming",
        "How do I create an iOS app?"
    ]
    
    for prompt in test_prompts:
        response = trainer.chat_with_bot(prompt)
        print(f"Human: {prompt}")
        print(f"Bot: {response}\n")
    
    # Interactive chat
    print("Start chatting (type 'quit' to exit):")
    while True:
        user_input = input("You: ")
        if user_input.lower() == 'quit':
            break
        bot_response = trainer.chat_with_bot(user_input)
        print(f"Bot: {bot_response}")

if __name__ == "__main__":
    main()
