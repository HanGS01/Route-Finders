import sys
from transformers import pipeline

# AI 모델 로드
classifier = pipeline("text-classification", model="smilegate-ai/kor_unsmile")

def check_bad_text(text):
    results = classifier(text)
    # results는 보통 리스트 형태로 반환됩니다.
    for res in results:
        # 비속어/혐오표현 라벨이 clean이 아니고 확률이 0.8 이상일 때
        if res['label'] != 'clean' and res['score'] > 0.8:
            return "BAD"
    return "GOOD"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        text_to_check = sys.argv[1]
        print(check_bad_text(text_to_check))