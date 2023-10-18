import { FlaggedFeature } from 'lib/components/FlaggedFeature'
import { FEATURE_FLAGS } from 'lib/constants'
import { NotebookButton } from '~/layout/navigation/TopBar/NotebookButton'

export function Panelbar(): JSX.Element {
    return (
        <div className="Panelbar">
            <FlaggedFeature flag={FEATURE_FLAGS.NOTEBOOKS}>
                <NotebookButton />
            </FlaggedFeature>
        </div>
    )
}
