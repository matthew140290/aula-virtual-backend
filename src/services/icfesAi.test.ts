import { generateQuestionsWithOpenAI } from './icfesAi.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ICFES AI Service', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    jest.clearAllMocks();
  });

  it('should generate questions correctly from AI response', async () => {
    const mockApiResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                preguntas: [
                  {
                    textoPregunta: 'Test question?',
                    nombreCompetencia: 'Interpretativa',
                    peso: 10,
                    explicacionRespuesta: 'Because yes.',
                    opciones: [
                      { letra: 'A', texto: 'Op 1', esCorrecta: true },
                      { letra: 'B', texto: 'Op 2', esCorrecta: false },
                      { letra: 'C', texto: 'Op 3', esCorrecta: false },
                      { letra: 'D', texto: 'Op 4', esCorrecta: false },
                    ]
                  }
                ]
              })
            }
          }
        ]
      }
    };

    mockedAxios.post.mockResolvedValueOnce(mockApiResponse);

    const result = await generateQuestionsWithOpenAI(
      { tema: 'Math', textoBase: '1+1', dificultad: 'BAJA', cantidad: 1 },
      [{ nombre: 'Interpretativa', peso: 100 }]
    );

    expect(result.preguntas).toHaveLength(1);
    expect(result.preguntas[0].textoPregunta).toBe('Test question?');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if OpenAI API key is missing', async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      generateQuestionsWithOpenAI(
        { tema: 'Math', textoBase: '1+1', dificultad: 'BAJA', cantidad: 1 },
        [{ nombre: 'Interpretativa', peso: 100 }]
      )
    ).rejects.toThrow('OPENAI_API_KEY no esta configurada en el backend.');
  });
});
