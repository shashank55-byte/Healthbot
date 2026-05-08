from severity_model import predict_and_confidence, train


def test_predict_flu_like():
    train()
    res = predict_and_confidence("fever and cough")
    assert isinstance(res, dict)
    assert "label" in res and "confidence" in res and "symptoms" in res and "probs" in res and "score" in res
    assert 0.0 <= res["confidence"] <= 1.0
    assert isinstance(res["symptoms"], list)
    assert isinstance(res["probs"], dict)


def test_predict_emergency():
    train()
    res = predict_and_confidence("chest pain and shortness of breath")
    assert isinstance(res, dict)
    assert "label" in res and "confidence" in res and "emergency_flag" in res
    assert 0.0 <= res["confidence"] <= 1.0
    assert res["emergency_flag"] is True
