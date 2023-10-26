export const SidePanelDocs = (): JSX.Element => {
    return (
        <div className="border-l w-full h-full overflow-hidden">
            <iframe src="https://posthog.com/docs" title="Docs" className="w-full h-full" />
        </div>
    )
}
