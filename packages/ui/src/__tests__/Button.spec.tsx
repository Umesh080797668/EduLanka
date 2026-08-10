import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/Button';

describe('Button component', () => {
    it('renders correctly with default props', () => {
        render(<Button>Click Me</Button>);
        const btn = screen.getByRole('button', { name: 'Click Me' });
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveClass('bg-blue-600');
    });

    it('applies variant and size classes properly', () => {
        render(<Button variant="danger" size="sm">Delete</Button>);
        const btn = screen.getByRole('button', { name: 'Delete' });
        expect(btn).toHaveClass('bg-red-600');
        expect(btn).toHaveClass('px-3'); // sm size
    });

    it('passes custom className and HTML attributes', () => {
        render(<Button className="custom-class" aria-label="custom-button">Btn</Button>);
        const btn = screen.getByLabelText('custom-button');
        expect(btn).toHaveClass('custom-class');
    });

    it('handles click events properly', () => {
        const onClick = jest.fn();
        render(<Button onClick={onClick}>Click</Button>);
        const btn = screen.getByRole('button');

        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
