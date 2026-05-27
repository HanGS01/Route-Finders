{
 "cells": [
  {
   "cell_type": "code",
   "execution_count": 1,
   "id": "03cba86d-6bac-42a5-9553-9c64ba943adc",
   "metadata": {},
   "outputs": [
    {
     "name": "stderr",
     "output_type": "stream",
     "text": [
      "Warning: You are sending unauthenticated requests to the HF Hub. Please set a HF_TOKEN to enable higher rate limits and faster downloads.\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "b3e9c85ab4144f37b72df07af404df9c",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Loading weights:   0%|          | 0/201 [00:00<?, ?it/s]"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    },
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GOOD\n"
     ]
    }
   ],
   "source": [
    "import sys\n",
    "from transformers import pipeline\n",
    "\n",
    "# AI 모델 로드 (최초 1회만 모델 로드되도록 합니다)\n",
    "classifier = pipeline(\"text-classification\", model=\"smilegate-ai/kor_unsmile\")\n",
    "\n",
    "def check_bad_text(text):\n",
    "    results = classifier(text)\n",
    "    for res in results:\n",
    "        # 욕설 확률이 60% 이상이면 True 반환\n",
    "        if res['label'] != 'clean' and res['score'] > 0.6:\n",
    "            return \"BAD\"\n",
    "    return \"GOOD\"\n",
    "\n",
    "# Node.js에서 전달받은 텍스트를 검사\n",
    "text_to_check = sys.argv[1]\n",
    "print(check_bad_text(text_to_check))"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "id": "5340a972-c816-4d62-93e8-188eba2680ae",
   "metadata": {},
   "outputs": [],
   "source": []
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python [conda env:base] *",
   "language": "python",
   "name": "conda-base-py"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.13.9"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 5
}
