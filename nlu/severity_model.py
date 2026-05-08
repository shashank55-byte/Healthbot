from pathlib import Path
import time
import os
import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
import joblib
import numpy as np
import argparse
import json

DATA_DIR = Path(__file__).resolve().parents[1] / 'data'
DATA_PATH = DATA_DIR / 'data_symptoms.csv'
MODEL_DIR = Path(__file__).resolve().parents[1] / 'models'
MODEL_PATH = MODEL_DIR / 'severity.pkl'

def build_label_from_symptoms(symptoms: list[str]) -> str:
    s = set((symptoms or []))
    if {'chest pain', 'shortness of breath', 'difficulty breathing', 'unconscious'} & s:
        return 'emergency'
    if 'fever' in s and 'cough' in s:
        return 'flu_like'
    if 'headache' in s:
        return 'migraine_like'
    return 'unknown'

def load_all_training_data() -> pd.DataFrame:
    rows = []
    if not DATA_DIR.exists():
        return pd.DataFrame(columns=['symptoms', 'label'])
    for fname in os.listdir(DATA_DIR):
        fpath = DATA_DIR / fname
        if not fpath.is_file():
            continue
        lower = fname.lower()
        if lower.endswith('.csv'):
            try:
                df = pd.read_csv(fpath)
            except Exception:
                continue
            cols = [c.strip() for c in df.columns]
            lcols = [c.lower() for c in cols]
            if 'symptoms' in lcols and 'label' in lcols:
                sidx = lcols.index('symptoms')
                lidx = lcols.index('label')
                for _, r in df.iterrows():
                    s = str(r[cols[sidx]]).strip()
                    l = str(r[cols[lidx]]).strip()
                    if s:
                        rows.append({'symptoms': s, 'label': l})
                continue
            if 'symptom' in lcols and 'severity' in lcols:
                sidx = lcols.index('symptom')
                vidx = lcols.index('severity')
                for _, r in df.iterrows():
                    s = str(r[cols[sidx]]).strip().lower()
                    try:
                        v = int(r[cols[vidx]])
                    except Exception:
                        v = 0
                    if v >= 4:
                        label = 'emergency'
                    elif v >= 2:
                        label = 'flu_like'
                    elif v == 1:
                        label = 'migraine_like'
                    else:
                        label = 'unknown'
                    if s:
                        rows.append({'symptoms': s, 'label': label})
                continue
            if 'disease' in lcols:
                non_sym = {'disease', 'age', 'gender', 'blood pressure', 'cholesterol level', 'outcome variable'}
                symptom_cols = [cols[i] for i, k in enumerate(lcols) if k not in non_sym]
                for _, r in df.iterrows():
                    syms = []
                    for c in symptom_cols:
                        val = str(r[c]).strip().lower()
                        if val and val not in {'0', 'no', 'false', 'none', 'null', 'n'}:
                            syms.append(c.strip().lower())
                    syms = list(dict.fromkeys(syms))
                    if syms:
                        label = build_label_from_symptoms(syms)
                        rows.append({'symptoms': ' '.join(syms), 'label': label})
                continue
            symptom_like = [c for c in lcols if c.startswith('symptom_')]
            if symptom_like:
                for _, r in df.iterrows():
                    syms = []
                    for c in symptom_like:
                        val = str(r[cols[lcols.index(c)]]).strip().lower()
                        if val:
                            syms.append(val)
                    syms = [s.replace('_', ' ') for s in syms if s]
                    syms = list(dict.fromkeys(syms))
                    if syms:
                        label = build_label_from_symptoms(syms)
                        rows.append({'symptoms': ' '.join(syms), 'label': label})
                continue
    if not rows:
        return pd.read_csv(DATA_PATH)
    df = pd.DataFrame(rows)
    df = df.dropna()
    df = df[df['symptoms'].astype(str).str.len() > 0]
    df = df.drop_duplicates()
    return df

def train(data_path: str | None = None, model_out: str = str(MODEL_PATH)):
    if data_path:
        df = pd.read_csv(data_path)
    else:
        df = load_all_training_data()
    X = df['symptoms'].astype(str).values
    y = df['label'].astype(str).values
    pipe = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), min_df=1),
        LogisticRegression(max_iter=1000, class_weight='balanced')
    )
    pipe.fit(X, y)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, model_out)
    return model_out

def load_model(model_path: str = str(MODEL_PATH)):
    p = Path(model_path)
    if p.exists():
        return joblib.load(p)
    return None

def extract_symptoms(text: str):
    t = (text or '').lower()
    keys = [
        'fever', 'cough', 'headache', 'chest pain', 'shortness of breath',
        'difficulty breathing', 'unconscious', 'nausea', 'fatigue', 'sore throat'
    ]
    found = [k for k in keys if k in t]
    return list(dict.fromkeys(found))

def build_recommendations(label: str, emergency: bool):
    if emergency:
        return ['Call emergency services', 'Do not delay medical attention']
    if label == 'severe':
        return ['Seek urgent medical care', 'Avoid strenuous activity', 'Hydrate and rest']
    if label == 'moderate':
        return ['Consult a doctor soon', 'Monitor symptoms', 'Hydrate and rest']
    return ['Rest', 'Hydrate', 'Use over-the-counter relief if needed']

def predict_and_confidence(text: str, model=None, model_path: str = str(MODEL_PATH)):
    if model is None:
        model = load_model(model_path)
    if model is None:
        train(None, model_path)
        model = load_model(model_path)
    probs = model.predict_proba([text])[0]
    classes = model.classes_
    idx = int(np.argmax(probs))
    label = str(classes[idx])
    conf = float(probs[idx])
    symptoms = extract_symptoms(text)
    emergency_flag = ('chest pain' in symptoms) or ('shortness of breath' in symptoms) or ('difficulty breathing' in symptoms) or ('unconscious' in symptoms)
    level_map = {
        'emergency': 'severe',
        'flu_like': 'moderate',
        'migraine_like': 'moderate',
        'unknown': 'mild'
    }
    severity = level_map.get(label, 'mild')
    dist = {str(c): float(p) for c, p in zip(classes, probs)}

    possible_causes = []
    sset = set(symptoms)
    if 'fever' in sset and 'cough' in sset:
        possible_causes.append('Flu or common cold')
    if 'fever' in sset and 'headache' in sset:
        possible_causes.append('Viral fever')
    if 'headache' in sset:
        possible_causes.append('Dehydration')
    if 'sore throat' in sset:
        possible_causes.append('Throat infection')
    if 'chest pain' in sset or 'shortness of breath' in sset or 'difficulty breathing' in sset:
        possible_causes.append('Cardiorespiratory issue')
    if not possible_causes:
        possible_causes.append('Non-specific viral syndrome')

    explanation = (f"{' + '.join(symptoms)} commonly indicate {severity} presentation "
                   f"due to suspected underlying causes.") if symptoms else f"Symptoms suggest a {severity} presentation."

    recommendations = (
        ['Seek urgent medical care', 'Avoid strenuous activity', 'Hydrate and rest'] if severity == 'severe' else
        ['Consult a doctor soon', 'Monitor symptoms', 'Hydrate and rest'] if severity == 'moderate' else
        ['Rest', 'Hydrate', 'Use over-the-counter relief if needed']
    )

    emergency_signs = []
    if severity == 'severe':
        emergency_signs.extend(['Severe chest pain', 'Shortness of breath', 'Unconsciousness'])
    if 'fever' in sset:
        emergency_signs.append('Fever > 39°C')
    if 'headache' in sset:
        emergency_signs.append('Severe headache')

    timestamp = int(time.time() * 1000)

    return {
        "assessment": severity,
        "confidence": int(round(conf * 100)),
        "reasons": possible_causes,
        "recommendations": recommendations,
        "emergency_signs": list(dict.fromkeys(emergency_signs)),
        "timestamp": timestamp,
        "symptoms": symptoms,
        "distribution": dist
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', type=str, default='')
    parser.add_argument('--train', action='store_true')
    args = parser.parse_args()

    if args.train:
        out = train()
        print(out)
    else:
        res = predict_and_confidence(args.text)
        print(json.dumps(res))
