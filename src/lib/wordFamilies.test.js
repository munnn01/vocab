import { describe, expect, it } from 'vitest';
import { getWordFamily, makeWordFamilyChoices } from './wordFamilies';

describe('wordFamilies module', () => {
  it('retrieves word family for dictionary words', () => {
    const fam = getWordFamily('creative', 'adj');
    expect(fam.adj).toBe('creative');
    expect(fam.v).toBe('create');
    expect(fam.n).toBe('creation');
    expect(fam.adv).toBe('creatively');
  });

  it('generates 4 distinct choices from the word family with exactly 1 correct answer', () => {
    const word = { id: 'w1', term: 'creative', partOfSpeech: 'adj', meaning: 'sáng tạo' };
    const choices = makeWordFamilyChoices(word);
    expect(choices).toHaveLength(4);

    const correct = choices.filter((c) => c.isCorrect);
    expect(correct).toHaveLength(1);
    expect(correct[0].term).toBe('creative');
    expect(correct[0].partOfSpeech).toBe('adj');

    const poses = choices.map((c) => c.partOfSpeech).sort();
    expect(poses).toEqual(['adj', 'adv', 'n', 'v']);
  });

  it('handles custom / unknown words via morphological rules', () => {
    const customWord = { id: 'w2', term: 'marvelous', partOfSpeech: 'adj', meaning: 'tuyệt diệu' };
    const choices = makeWordFamilyChoices(customWord);
    expect(choices).toHaveLength(4);

    const correct = choices.find((c) => c.isCorrect);
    expect(correct).toBeDefined();
    expect(correct.term).toBe('marvelous');
  });
});
