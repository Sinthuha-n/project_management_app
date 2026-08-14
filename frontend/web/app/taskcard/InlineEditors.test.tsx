import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DescriptionEditor from './main/DescriptionEditor';
import StoryPointSection from './sidebar/StoryPointSection';

describe('task inline editors', () => {
  it('commits story points once when Enter causes a blur', async () => {
    const user = userEvent.setup();
    const onUpdateStoryPoint = jest.fn();
    render(<StoryPointSection storyPoint={3} onUpdateStoryPoint={onUpdateStoryPoint} />);

    await user.click(screen.getByText('3'));
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '5{Enter}');

    expect(onUpdateStoryPoint).toHaveBeenCalledTimes(1);
    expect(onUpdateStoryPoint).toHaveBeenCalledWith(5);
  });

  it('commits a description once when the Save button changes focus', async () => {
    const user = userEvent.setup();
    const onUpdateDescription = jest.fn();
    render(<DescriptionEditor description="Original" onUpdateDescription={onUpdateDescription} />);

    await user.click(screen.getByText('Original'));
    const editor = screen.getByRole('textbox');
    await user.clear(editor);
    await user.type(editor, 'Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdateDescription).toHaveBeenCalledTimes(1);
    expect(onUpdateDescription).toHaveBeenCalledWith('Updated');
  });

  it('does not save story points when editing is cancelled', async () => {
    const user = userEvent.setup();
    const onUpdateStoryPoint = jest.fn();
    render(<StoryPointSection storyPoint={3} onUpdateStoryPoint={onUpdateStoryPoint} />);

    await user.click(screen.getByText('3'));
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '8{Escape}');

    expect(onUpdateStoryPoint).not.toHaveBeenCalled();
  });
});
